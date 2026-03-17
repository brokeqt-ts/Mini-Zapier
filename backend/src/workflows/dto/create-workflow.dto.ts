import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({ example: 'My Workflow' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Sends notifications on webhook', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
