import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate'
import { uploadFile } from '../../storage'
import path from 'path'

const ALLOWED_RECORDING_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
]

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadRoutes(fastify: FastifyInstance): Promise<void> {

  // ─────────────────────────────────────────
  // POST /upload/recording
  // Employee uploads call recording
  // Returns URL to store in InteractionLog
  // ─────────────────────────────────────────
  fastify.post('/recording', {
    preHandler: authenticate,
  }, async (request, reply) => {

    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No file provided' },
      })
    }

    // Validate file type
    if (!ALLOWED_RECORDING_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only audio/video files are allowed for recordings',
        },
      })
    }

    // Read buffer and check size
    const buffer = await data.toBuffer()

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size cannot exceed 10MB',
        },
      })
    }

    const ext = path.extname(data.filename)
    const fileName = `${Date.now()}-recording${ext}`

    const result = await uploadFile({
      buffer,
      fileName,
      mimeType: data.mimetype,
      folder: 'recordings',
    })

    return reply.status(200).send({
      success: true,
      data: { url: result.url, key: result.key },
    })
  })

  // ─────────────────────────────────────────
  // POST /upload/document
  // Employee uploads student document
  // Returns URL to store in LeadDocument
  // ─────────────────────────────────────────
  fastify.post('/document', {
    preHandler: authenticate,
  }, async (request, reply) => {

    const data = await request.file()

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'No file provided' },
      })
    }

    // Validate file type
    if (!ALLOWED_DOCUMENT_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only PDF, JPG, and PNG files are allowed for documents',
        },
      })
    }

    const buffer = await data.toBuffer()

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size cannot exceed 10MB',
        },
      })
    }

    const ext = path.extname(data.filename)
    const fileName = `${Date.now()}-doc${ext}`

    const result = await uploadFile({
      buffer,
      fileName,
      mimeType: data.mimetype,
      folder: 'documents',
    })

    return reply.status(200).send({
      success: true,
      data: { url: result.url, key: result.key },
    })
  })
}