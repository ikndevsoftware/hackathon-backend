import { config } from 'dotenv';

config();

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ArcjetGuard, ArcjetModule } from '@arcjet/nest';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { auth } from './lib/auth/auth.js';
import { buildArcjetRules, type ArcjetMode } from './lib/arcjet/arcjet.rules.js';
import { PrismaModule } from './lib/database/prisma.module.js';
import { HackathonModule } from './module/hackathon/hackathon.module.js';
import { UserModule } from './module/user/user.module.js';

const arcjetMode: ArcjetMode =
  process.env.ARCJET_MODE === 'LIVE' ? 'LIVE' : 'DRY_RUN';

@Module({
  imports: [
    ArcjetModule.forRoot({
      isGlobal: true,
      key: process.env.ARCJET_KEY!,
      rules: buildArcjetRules(arcjetMode),
    }),
    AuthModule.forRoot({ auth }),
    PrismaModule,
    UserModule,
    HackathonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ArcjetGuard,
    },
  ],
})
export class AppModule {}
