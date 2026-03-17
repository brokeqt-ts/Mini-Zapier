import {
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NodeType } from '@prisma/client';

export class CanvasNodeDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ enum: NodeType })
  @IsEnum(NodeType)
  type: NodeType;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsObject()
  config: Record<string, unknown>;

  @ApiProperty()
  @IsNumber()
  positionX: number;

  @ApiProperty()
  @IsNumber()
  positionY: number;
}

export class CanvasEdgeDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  sourceNodeId: string;

  @ApiProperty()
  @IsString()
  targetNodeId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conditionExpr?: string;
}

export class SaveCanvasDto {
  @ApiProperty({ type: [CanvasNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanvasNodeDto)
  nodes: CanvasNodeDto[];

  @ApiProperty({ type: [CanvasEdgeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CanvasEdgeDto)
  edges: CanvasEdgeDto[];
}
