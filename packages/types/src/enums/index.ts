export enum Role {
    EMPLOYEE = 'EMPLOYEE',
    SUB_ADMIN = 'SUB_ADMIN',
    ADMIN = 'ADMIN',
  }
  
  export enum LeadStatus {
    NEW = 'NEW',
    ATTEMPTED_CONTACT = 'ATTEMPTED_CONTACT',
    CONNECTED = 'CONNECTED',
    INTERESTED = 'INTERESTED',
    FOLLOW_UP_SCHEDULED = 'FOLLOW_UP_SCHEDULED',
    APPLICATION_SENT = 'APPLICATION_SENT',
    UNDER_VALIDATION = 'UNDER_VALIDATION',
    CONFIRMED = 'CONFIRMED',
    LOST = 'LOST',
    NOT_INTERESTED = 'NOT_INTERESTED',
    NOT_REACHABLE = 'NOT_REACHABLE',
    DUPLICATE = 'DUPLICATE',
  }
  
  export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER',
  }
  
  export enum MaritalStatus {
    SINGLE = 'SINGLE',
    MARRIED = 'MARRIED',
  }
  
  export enum QualificationLevel {
    TENTH = 'TENTH',
    TWELFTH = 'TWELFTH',
    GRADUATION = 'GRADUATION',
    POST_GRADUATION = 'POST_GRADUATION',
    OTHER = 'OTHER',
  }
  
  export enum InteractionType {
    NOTE = 'NOTE',
    CALL = 'CALL',
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    MEETING = 'MEETING',
    DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
    STATUS_CHANGED = 'STATUS_CHANGED',
  }
  
  // Lead status transition map
  // Defines which statuses a lead can move TO from each current status
  // This is the state machine contract — core enforces it, frontend reads it
  export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
    [LeadStatus.NEW]: [
      LeadStatus.ATTEMPTED_CONTACT,
      LeadStatus.CONNECTED,
      LeadStatus.NOT_REACHABLE,
      LeadStatus.DUPLICATE,
      LeadStatus.LOST,
    ],
    [LeadStatus.ATTEMPTED_CONTACT]: [
      LeadStatus.CONNECTED,
      LeadStatus.NOT_REACHABLE,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.LOST,
      LeadStatus.FOLLOW_UP_SCHEDULED,
    ],
    [LeadStatus.CONNECTED]: [
      LeadStatus.INTERESTED,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.FOLLOW_UP_SCHEDULED,
      LeadStatus.LOST,
    ],
    [LeadStatus.INTERESTED]: [
      LeadStatus.FOLLOW_UP_SCHEDULED,
      LeadStatus.APPLICATION_SENT,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.LOST,
    ],
    [LeadStatus.FOLLOW_UP_SCHEDULED]: [
      LeadStatus.CONNECTED,
      LeadStatus.ATTEMPTED_CONTACT,
      LeadStatus.INTERESTED,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.LOST,
    ],
    [LeadStatus.APPLICATION_SENT]: [
      LeadStatus.UNDER_VALIDATION,
      LeadStatus.LOST,
      LeadStatus.NOT_INTERESTED,
    ],
    [LeadStatus.UNDER_VALIDATION]: [
      LeadStatus.CONFIRMED,
      LeadStatus.LOST,
      LeadStatus.APPLICATION_SENT,
    ],
    [LeadStatus.CONFIRMED]: [],   // terminal — no further transitions
    [LeadStatus.LOST]: [
      LeadStatus.ATTEMPTED_CONTACT, // can be revived
    ],
    [LeadStatus.NOT_INTERESTED]: [
      LeadStatus.ATTEMPTED_CONTACT, // can be revived
    ],
    [LeadStatus.NOT_REACHABLE]: [
      LeadStatus.ATTEMPTED_CONTACT,
      LeadStatus.CONNECTED,
    ],
    [LeadStatus.DUPLICATE]: [],   // terminal — stays duplicate
  }