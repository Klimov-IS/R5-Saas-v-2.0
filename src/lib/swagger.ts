/**
 * Swagger/OpenAPI Stub Module
 *
 * This is a placeholder to satisfy TypeScript imports.
 * Swagger documentation is served via /api/docs route.
 */

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'WB Reputation Manager API',
    version: '1.0.0',
    description: 'API for managing Wildberries store reputation',
  },
  servers: [
    {
      url: 'http://localhost:9002',
      description: 'Development server',
    },
  ],
};

export default swaggerSpec;
