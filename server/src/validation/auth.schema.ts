// src/validation/auth.schema.ts
import Joi from 'joi';

// DRY VIOLATION NOTE: Multiple validation duplications in this file
export const registerSchema = Joi.object({
  // DRY VIOLATION: Email validation logic 2/2. Other location: auth.service.ts line 45-48
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),

  // DRY VIOLATION: Password validation logic 3/3. Other locations: auth.service.ts line 33-42, user.model.ts line 52-60
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters long',
      'string.max': 'Password cannot exceed {#limit} characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    })
}).options({ stripUnknown: true, abortEarly: false });

// DRY VIOLATION NOTE: Email validation duplicated below
export const loginSchema = Joi.object({
  // DRY VIOLATION: Email validation logic 2/2. Other location: auth.service.ts line 45-48
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
}).options({ stripUnknown: true, abortEarly: false });