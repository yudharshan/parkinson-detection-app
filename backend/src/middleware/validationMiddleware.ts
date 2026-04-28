import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';


const sessionSchema = Joi.object({
    userId: Joi.string().required().messages({
        'string.empty': 'User ID cannot be empty'
    }),
    taskType: Joi.string()
        .valid('accelerometer', 'tapping', 'reaction_time')
        .required(),
    
    payload: Joi.object({
        
        samples: Joi.array().items(
            Joi.object({
                x: Joi.number().required(),
                y: Joi.number().required(),
                z: Joi.number().required()
            })
        ).optional(),
        
        
        tapOffsets: Joi.array().items(Joi.number()).optional(),
        
        
        meanReactionTimeMs: Joi.number().optional(),
        rawLatency: Joi.array().items(Joi.number()).optional()
    }).required(),

    startedAt: Joi.date().iso().required(),
    endedAt: Joi.date().iso().required()
}).unknown(true); 

export const validateSession = (req: Request, res: Response, next: NextFunction) => {
    
    const { error } = sessionSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map((detail) => detail.message);
        console.log("🚫 Validation Failed:", errorMessages);
        return res.status(400).json({ 
            success: false, 
            errors: errorMessages 
        });
    }

    next();
};