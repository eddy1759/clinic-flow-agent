import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// import helmet from 'helmet'; // Recommended: npm i helmet
import { IoAdapter } from '@nestjs/platform-socket.io';
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.useWebSocketAdapter(new IoAdapter(app));

  // 1. Security & CORS
  // app.use(helmet()); // Uncomment for production security headers
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // 2. Global Prefix (e.g., http://localhost:4000/api/v1/messaging/chat)
  app.setGlobalPrefix('api/v1');

  // 3. Validation Pipeline (Strict DTO enforcement)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips away extra data sent by hackers
      forbidNonWhitelisted: true, // Throws error if extra data exists
      transform: true, // Auto-converts payload to DTO instance
    }),
  );

  // 4. Swagger Documentation Setup
  // This generates the UI for your MessagingController
  const config = new DocumentBuilder()
    .setTitle('Clinic AI Agent API')
    .setDescription('HIPAA-compliant conversational scheduling agent')
    .setVersion('1.0')
    .addTag('Messaging')
    .addTag('Voice')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 5. Start Server
  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
  logger.log(`📄 Swagger Docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
