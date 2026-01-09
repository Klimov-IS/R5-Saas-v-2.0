
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth, useFirestore } from "@/firebase";
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
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

const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (!auth || !firestore) {
        toast({
            variant: "destructive",
            title: "Ошибка конфигурации",
            description: "Сервисы аутентификации не загружены.",
        });
        return;
    }

    try {
        // Step 1: Just try to sign in. The logic for profile check/creation
        // is now handled in WbReputationManager component after a successful login.
        await initiateEmailSignIn(auth, data.email, data.password);
        
        // No toast here on success, as the user will be redirected or logged out
        // by the logic in the main component.

    } catch (error: any) {
        // This will only catch auth errors like wrong password.
        toast({
            variant: "destructive",
            title: "Ошибка входа",
            description: "Неверный email или пароль. Попробуйте еще раз.",
        });
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
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Вход..." : "Войти"}
        </Button>
      </form>
    </Form>
  );
}
