"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const joi_1 = require("joi");
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.validateAsync(req.body, { abortEarly: false });
            next();
        }
        catch (error) {
            if (error instanceof joi_1.ValidationError) {
                res.status(400).json({
                    status: 'error',
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                });
                return;
            }
            next(error);
        }
    };
};
exports.validateRequest = validateRequest;
