
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth, useFirestore } from "@/firebase";
import { initiateEmailSignUp } from "@/firebase/non-blocking-login";
import { doc, setDoc } from "firebase/firestore";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@/lib/types";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const signupSchema = z
  .object({
    email: z.string().email("Неверный формат email"),
    password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    if (!auth || !firestore) {
        toast({
            variant: "destructive",
            title: "Ошибка конфигурации",
            description: "Сервисы аутентификации не загружены.",
        });
        return;
    }
    
    try {
      const userCredential = await initiateEmailSignUp(auth, data.email, data.password);
      const user = userCredential.user;

      const userProfileRef = doc(firestore, "users", user.uid);
      const newUserProfile: UserProfile = {
        uid: user.uid,
        email: user.email!,
        isApproved: false // Users are not approved by default
      };

      try {
        await setDoc(userProfileRef, newUserProfile);
      } catch (firestoreError) {
        console.error("Failed to create user profile after signup:", firestoreError);
        const permissionError = new FirestorePermissionError({
          path: userProfileRef.path,
          operation: 'create',
          requestResourceData: newUserProfile,
        });
        errorEmitter.emit('permission-error', permissionError);
        // Even if profile creation fails, we proceed to sign out and notify.
      }


      // Sign the user out immediately after registration
      await auth.signOut();

      toast({
        title: "Регистрация успешна!",
        description: "Ваш аккаунт создан. Дождитесь подтверждения от администратора для входа.",
      });

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            toast({
                variant: "destructive",
                title: "Ошибка регистрации",
                description: "Этот email уже используется. Попробуйте войти.",
            });
        } else {
             toast({
                variant: "destructive",
                title: "Ошибка регистрации",
                description: error.message || "Произошла неизвестная ошибка.",
            });
        }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Подтвердите пароль</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
      </form>
    </Form>
  );
}
