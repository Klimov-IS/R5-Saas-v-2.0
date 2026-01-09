
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { isFirestorePermissionError, type FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '@/firebase';

/**
 * A client component that listens for custom 'permission-error' events
 * and throws them to be caught by Next.js's error overlay.
 *
 * This is a DEVELOPMENT-ONLY tool. It should not be used in production.
 */
export function FirebaseErrorListener() {
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    const handleError = (permissionError: FirestorePermissionError) => {
      // Enhance the error message with the current auth state
      const enhancedError = new Error(
        `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:`
      );

      const requestDetails = {
        // Only include auth details if the user object is available
        auth: !isUserLoading && user ? {
          uid: user.uid,
          token: {
            email: user.email,
            email_verified: user.emailVerified,
            phone_number: user.phoneNumber,
            name: user.displayName,
            // Mimic the structure of rules.request.auth for easier debugging
            firebase: {
              identities: user.providerData.reduce((acc, p) => ({ ...acc, [p.providerId]: p.uid }), {}),
              sign_in_provider: user.providerId,
            }
          }
        } : null,
        method: permissionError.context.operation,
        path: `/databases/(default)/documents/${permissionError.context.path}`,
        // Conditionally include resource data if it exists
        ...(permissionError.context.requestResourceData && {
          resource: {
            data: permissionError.context.requestResourceData,
          }
        }),
      };

      // Append the JSON details to the error message
      enhancedError.message += `\n${JSON.stringify(requestDetails, null, 2)}`;
      
      // Keep the original stack trace for better debugging
      enhancedError.stack = permissionError.stack;

      // Throw the error so the Next.js overlay can catch it.
      // We use a timeout to escape the event handler's context.
      setTimeout(() => {
        throw enhancedError;
      }, 0);
    };

    const permissionErrorHandler = (error: unknown) => {
      if (isFirestorePermissionError(error)) {
        handleError(error);
      }
    };

    errorEmitter.on('permission-error', permissionErrorHandler);

    return () => {
      errorEmitter.off('permission-error', permissionErrorHandler);
    };
  }, [user, isUserLoading]);

  // This component does not render anything
  return null;
}
