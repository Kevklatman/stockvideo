// src/dtos/video.dto.ts
import { IsString, IsNumber, IsOptional, Min, MaxLength, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVideoDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  price!: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateVideoDto {
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  price?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class VideoResponseDto {
  @IsUUID()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price!: number;

  @IsString()
  previewUrl!: string;

  @IsString()
  @IsOptional()
  fullVideoUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  stripeProductId?: string;

  @IsString()
  @IsOptional()
  stripePriceId?: string;

  constructor(partial: Partial<VideoResponseDto>) {
    Object.assign(this, partial);
  }
}

export class VideoSearchDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  sort?: 'newest' | 'oldest' | 'popular';
}