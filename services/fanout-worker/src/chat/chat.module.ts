import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChatService } from './chat.service';

@Module({
  imports: [HttpModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
