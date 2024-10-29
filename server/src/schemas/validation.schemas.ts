// src/schemas/validation.schemas.ts
import * as yup from 'yup';

export const authSchemas = {
  register: {
    body: yup.object({
      email: yup.string()
        .email('Invalid email format')
        .required('Email is required'),
      password: yup.string()
        .min(8, 'Password must be at least 8 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/[0-9]/, 'Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
        .required('Password is required')
    })
  },
  login: {
    body: yup.object({
      email: yup.string()
        .email('Invalid email format')
        .required('Email is required'),
      password: yup.string()
        .required('Password is required')
    })
  }
};

export const videoSchemas = {
  create: {
    body: yup.object({
      title: yup.string()
        .min(3, 'Title must be at least 3 characters')
        .max(100, 'Title must be at most 100 characters')
        .required('Title is required'),
      description: yup.string()
        .max(1000, 'Description must be at most 1000 characters')
        .optional(),
      price: yup.number()
        .min(0, 'Price cannot be negative')
        .max(1000000, 'Price cannot exceed 1,000,000')
        .required('Price is required'),
      tags: yup.array()
        .of(yup.string())
        .max(10, 'Maximum 10 tags allowed')
        .optional()
    })
  },
  update: {
    params: yup.object({
      id: yup.string()
        .uuid('Invalid video ID')
        .required('Video ID is required')
    }),
    body: yup.object({
      title: yup.string()
        .min(3, 'Title must be at least 3 characters')
        .max(100, 'Title must be at most 100 characters')
        .optional(),
      description: yup.string()
        .max(1000, 'Description must be at most 1000 characters')
        .optional(),
      price: yup.number()
        .min(0, 'Price cannot be negative')
        .max(1000000, 'Price cannot exceed 1,000,000')
        .optional(),
      tags: yup.array()
        .of(yup.string())
        .max(10, 'Maximum 10 tags allowed')
        .optional()
    })
  },
  search: {
    query: yup.object({
      q: yup.string()
        .min(2, 'Search query must be at least 2 characters')
        .optional(),
      page: yup.number()
        .min(1, 'Page must be at least 1')
        .optional(),
      limit: yup.number()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
        .optional(),
      minPrice: yup.number()
        .min(0, 'Minimum price cannot be negative')
        .optional(),
      maxPrice: yup.number()
        .min(0, 'Maximum price cannot be negative')
        .optional(),
      tags: yup.array()
        .of(yup.string())
        .optional()
    })
  }
};