# DRY Principle Violations Reference

This document tracks all identified violations of the DRY (Don't Repeat Yourself) principle in the codebase. Each violation is categorized and includes specific file locations and line numbers.

## 1. Password Validation Logic (3 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/3 | `/server/src/services/auth.service.ts` | 33-42 | Implementation of password validation logic |
| 2/3 | `/server/src/models/user.model.ts` | 52-60 | Similar implementation in User model |
| 3/3 | `/server/src/validation/auth.schema.ts` | 18-21 | Regex pattern for password validation |

## 2. Email Validation Logic (2 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/2 | `/server/src/services/auth.service.ts` | 45-48 | Custom regex email validator |
| 2/2 | `/server/src/validation/auth.schema.ts` | 7-12, 35-40 | Joi email validation in both schemas |

## 3. Interface Duplication (2 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/2 | `/server/src/services/auth.service.ts` | 6-12 | RegisterResponse interface |
| 2/2 | `/server/src/services/auth.service.ts` | 14-21 | LoginResponse interface (nearly identical) |

## 4. Field Validation Redundancy (2 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/2 | `/server/src/controllers/auth.controller.ts` | 14-22 | Email/password presence check in login method |
| 2/2 | `/server/src/controllers/auth.controller.ts` | 85-93 | Same check duplicated in register method |

## 5. Response Formatting Duplication (3 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/3 | `/server/src/controllers/auth.controller.ts` | 28-38 | Success response structure in login method |
| 2/3 | `/server/src/controllers/auth.controller.ts` | 68-78 | Similar structure in validateToken method |
| 3/3 | `/server/src/controllers/auth.controller.ts` | 95-105 | Similar structure in register method |

## 6. Error Handling Duplication (2 instances)

| # | File | Line Numbers | Description |
|---|------|--------------|-------------|
| 1/2 | `/server/src/controllers/auth.controller.ts` | 40-48 | Error response formatting in login method |
| 2/2 | `/server/src/controllers/auth.controller.ts` | 107-115 | Similar error handling in register method |

## Recommendations for Improvement

1. **Create Shared Utilities**:
   - Extract password validation into a shared utility function
   - Rely on a single email validation implementation

2. **Use Type Aliases or Generic Interfaces**:
   - Replace duplicate interfaces with a single generic interface or type alias

3. **Implement Response Formatters**:
   - Create helper functions for formatting success and error responses

4. **Use Middleware for Validation**:
   - Move field validation to middleware that uses Joi schemas

5. **Extract Common Error Handling**:
   - Create a centralized error handling middleware
