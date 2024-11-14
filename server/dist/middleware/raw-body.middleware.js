"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preserveRawBody = void 0;
const preserveRawBody = (req, res, next) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = Buffer.from(data);
        next();
    });
};
exports.preserveRawBody = preserveRawBody;
