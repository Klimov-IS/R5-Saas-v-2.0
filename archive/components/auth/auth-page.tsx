
"use client";

import { useState } from "react";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";

export default function AuthPage() {
  const [isLoginView, setIsLoginView] = useState(true);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
            <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
              <Store className="h-8 w-8" />
            </div>
          <CardTitle className="text-2xl font-headline">
            {isLoginView ? 'С возвращением' : 'Создать аккаунт'}
          </CardTitle>
          <CardDescription>
            {isLoginView ? 'Войдите, чтобы управлять вашими магазинами.' : 'Заполните форму для регистрации.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoginView ? <LoginForm /> : <SignupForm />}
          <div className="mt-4 text-center text-sm">
            {isLoginView ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => setIsLoginView(!isLoginView)}>
              {isLoginView ? "Зарегистрироваться" : "Войти"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
