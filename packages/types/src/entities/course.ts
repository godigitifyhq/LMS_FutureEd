export type Course = {
    id: string
    name: string
    code: string | null
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }
  
  export type LeadSourceType = {
    id: string
    name: string
    isActive: boolean
    createdAt: Date
  }