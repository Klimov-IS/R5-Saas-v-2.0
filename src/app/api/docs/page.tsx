'use client';

import React, { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Loader2 } from 'lucide-react';

export default function ApiDocPage() {
  const [spec, setSpec] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/openapi.json')
      .then((res) => res.json())
      .then((apiSpec) => {
        setSpec(apiSpec);
      })
      .catch((error) => {
        console.error('Failed to load API spec:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-4" />
            <p>Загрузка документации API...</p>
        </div>
    );
  }
  
  if (!spec) {
     return (
        <div className="flex justify-center items-center h-screen">
            <p className="text-destructive">Не удалось загрузить спецификацию API.</p>
        </div>
    );
  }

  // Этот перехватчик необходим для корректной работы авторизации в Swagger UI с Next.js.
  const requestInterceptor = (req: any) => {
    if ((window as any).swaggerUi) {
        const ui = (window as any).swaggerUi;
        const token = ui.getState().getIn(['auth', 'authorized', 'ApiKeyAuth', 'value']);

        if (token) {
            const finalToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            req.headers.Authorization = finalToken;
        }
    }
    return req;
  };
  
  // Этот коллбэк дает нам стабильную ссылку на внутренний экземпляр Swagger UI.
  const onComplete = (ui: any) => {
    (window as any).swaggerUi = ui;
  };

  return (
    <section className="container">
      <SwaggerUI spec={spec} requestInterceptor={requestInterceptor} onComplete={onComplete} />
    </section>
  );
}
