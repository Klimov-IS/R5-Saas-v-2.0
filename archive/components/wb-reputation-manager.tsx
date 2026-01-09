
"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, useAuth } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";
import { collection, query, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import type { Store, WithId, UserProfile, Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LogOut, PlusCircle, Store as StoreIcon, Loader2, Settings, RefreshCw, Users, Send } from "lucide-react";
import { StoreList } from "./stores/store-list";
import { AddStoreDialog } from "./stores/add-store-dialog";
import { EditStoreDialog } from "./stores/edit-store-dialog";
import { Card, CardContent } from "@/components/ui/card";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useApiActions } from "@/hooks/use-api-actions";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"


export default function WbReputationManager() {
  const auth = useAuth();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [storeToEdit, setStoreToEdit] = useState<WithId<Store> | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<WithId<Store> | null>(null);
  const [isAddStoreOpen, setAddStoreOpen] = useState(false);
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { triggerUpdate, isUpdating } = useApiActions();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (isAuthLoading || !user || !firestore || hasCheckedProfile) {
        return;
    }
    
    const checkAndCreateProfile = async () => {
        setHasCheckedProfile(true);
        const profileRef = doc(firestore, 'users', user.uid);
        try {
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
                const profileData = profileSnap.data() as UserProfile;
                if (!profileData.isApproved) {
                    toast({
                        variant: "destructive",
                        title: "Доступ запрещен",
                        description: "Ваша учетная запись не подтверждена. Обратитесь к администратору.",
                    });
                    initiateSignOut(auth);
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Требуется подтверждение",
                    description: "Ваша учетная запись требует подтверждения администратором.",
                });

                const newUserProfile: UserProfile = {
                    uid: user.uid,
                    email: user.email!,
                    isApproved: false,
                };
                
                try {
                    await setDoc(profileRef, newUserProfile);
                } catch (setDocError) {
                    const permissionError = new FirestorePermissionError({
                        path: profileRef.path,
                        operation: 'create',
                        requestResourceData: newUserProfile,
                    });
                    errorEmitter.emit('permission-error', permissionError);
                } finally {
                    initiateSignOut(auth);
                }
            }
        } catch (error) {
            console.error("Error checking/creating user profile:", error);
            initiateSignOut(auth);
        }
    };

    checkAndCreateProfile();
  }, [user, isAuthLoading, firestore, auth, toast, hasCheckedProfile]);


  const storesQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "stores")) : null),
    [firestore]
  );
  const { data: stores, isLoading: isLoadingStores } = useCollection<WithId<Store>>(storesQuery);
  
  const isAnyTaskRunning = stores?.some(s => isUpdating(s.id, 'dialogues') || isUpdating(s.id, 'reviews') || isUpdating(undefined, 'recalculate') || isUpdating(undefined, 'send-no-reply'));
  
  function handleSignOut() {
    if (auth) {
      initiateSignOut(auth);
    }
  }

  function handleEditStore(store: WithId<Store>) {
    setStoreToEdit(store);
  }

  function handleDeleteStore(store: WithId<Store>) {
    setStoreToDelete(store);
  }
  
  async function confirmDeleteStore() {
    if (!storeToDelete || !firestore) return;
    setIsDeleting(true);

    try {
        const response = await fetch(`/api/stores/${storeToDelete.id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(window as any)?.__APP_CONFIG__?.apiKey}`,
            },
        });
        
        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || `Failed to delete store: ${response.status}`);
        }

        toast({
            title: "Магазин удален",
            description: `Магазин "${storeToDelete.name}" был успешно удален.`
        });
        
        setStoreToDelete(null);

    } catch(error: any) {
         toast({
            variant: "destructive",
            title: "Ошибка удаления",
            description: error.message || "Не удалось удалить магазин."
        });
    } finally {
        setIsDeleting(false);
    }
  }

  const isLoading = isLoadingStores || isAuthLoading || isProfileLoading;
  
  if (isLoading || (user && !userProfile)) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Загрузка ваших магазинов...</p>
      </div>
    );
  }
  
  if (userProfile && !userProfile.isApproved) {
     return (
      <div className="flex flex-col justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Проверка доступа...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
         <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-lg">
                <StoreIcon className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary">
                Все магазины
            </h1>
        </div>
        <div className="flex items-center gap-2">
          {user && !user.isAnonymous && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
          <Link href="/settings" passHref>
             <Button variant="outline" size="icon" aria-label="Настройки">
                <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/users-rules" passHref>
             <Button variant="outline" size="icon" aria-label="Пользователи">
                <Users className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="icon" aria-label="Выйти" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Card className="mb-8">
        <CardContent className="p-4 flex flex-wrap items-center justify-start gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddStoreOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Добавить магазин
            </Button>
            <Button variant="outline" size="sm" onClick={() => triggerUpdate(undefined, 'recalculate')} disabled={isAnyTaskRunning}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isUpdating(undefined, 'recalculate') && 'animate-spin')} />
              Пересчитать всю статистику
            </Button>
            <Button variant="outline" size="sm" onClick={() => triggerUpdate(undefined, 'send-no-reply')} disabled={isAnyTaskRunning}>
              <Send className={cn("mr-2 h-4 w-4", isUpdating(undefined, 'send-no-reply') && 'animate-spin')} />
              Запустить авто-рассылку
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
            <StoreList 
                stores={stores || []} 
                onEditStore={handleEditStore}
                onDeleteStore={handleDeleteStore}
            />
        </CardContent>
      </Card>


      <AddStoreDialog
        isOpen={isAddStoreOpen}
        onOpenChange={setAddStoreOpen}
      />
      
      <EditStoreDialog
        store={storeToEdit}
        isOpen={!!storeToEdit}
        onOpenChange={(open) => !open && setStoreToEdit(null)}
      />

       <AlertDialog open={!!storeToDelete} onOpenChange={(open) => !open && setStoreToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие необратимо. Магазин "{storeToDelete?.name}" будет удален.
              Товары, отзывы и чаты, связанные с этим магазином, останутся в базе данных.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteStore} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
