export interface ProjectTypeOption {
  id: string
  label: string
  description: string
}

export type InventoryDataSource = 'live' | 'preview'
export type ProjectMembershipRole = 'owner' | 'editor' | 'viewer'
export type ItemAdjustmentReason = 'restock' | 'usage' | 'correction' | 'inventory_count' | 'other'

export interface ProjectPreview {
  id: string
  name: string
  typeId: string
  typeLabel: string
  summary: string
  memberCount: number
  itemCount: number
  lowStockCount: number
  lastUpdated: string
  tags: string[]
  membershipRole?: ProjectMembershipRole | null
}

export interface LowStockItemPreview {
  id: string
  projectId: string
  projectName: string
  name: string
  quantity: number
  unit: string
  threshold: number
  location: string
  tags: string[]
}

export interface SuggestedItemPreview {
  id: string
  projectTypeId: string
  name: string
  defaultUnit: string
  tags: string[]
}

export interface ProjectItemPhotoPreview {
  fileSizeBytes: number | null
  mimeType: string | null
  storagePath: string
  url: string
}

export interface ProjectItemPreview {
  id: string
  name: string
  quantity: number
  suggestedItemId?: string | null
  unit: string
  threshold: number
  location: string | null
  vendor: string | null
  cost: string | null
  notes: string | null
  photo: ProjectItemPhotoPreview | null
  tags: string[]
  isLowStock: boolean
}

export interface TagOption {
  id: string
  name: string
  color: string | null
}

export interface ItemAdjustmentPreview {
  id: string
  itemId: string
  itemName: string
  delta: number
  note: string | null
  createdAtLabel: string
  newQuantity: number
  reason: ItemAdjustmentReason
}

export interface DashboardData {
  source: InventoryDataSource
  notice: string | null
  lowStockItems: LowStockItemPreview[]
  projectTypes: ProjectTypeOption[]
  projects: ProjectPreview[]
}

export interface ProjectDetailData {
  source: InventoryDataSource
  notice: string | null
  availableTags: TagOption[]
  canEditProject: boolean
  project: ProjectPreview
  items: ProjectItemPreview[]
  recentAdjustments: ItemAdjustmentPreview[]
  suggestions: SuggestedItemPreview[]
}

export interface ProjectCreateInput {
  description: string | null
  name: string
  projectTypeId: string | null
}

export interface ProjectItemCreateInput {
  cost: number | null
  existingTagIds: string[]
  lowStockThreshold: number
  name: string
  newTagNames: string[]
  notes: string | null
  projectId: string
  quantity: number
  storageLocation: string | null
  suggestedItemId: string | null
  unit: string
  vendor: string | null
}

export interface ProjectItemUpdateInput {
  cost: number | null
  existingTagIds: string[]
  itemId: string
  lowStockThreshold: number
  name: string
  newTagNames: string[]
  notes: string | null
  quantity: number
  storageLocation: string | null
  suggestedItemId: string | null
  unit: string
  vendor: string | null
}

export interface ProjectItemAdjustmentInput {
  delta: number
  itemId: string
  note: string | null
  reason: ItemAdjustmentReason
}

export interface ProjectItemPhotoUploadInput {
  existingStoragePath: string | null
  file: File
  itemId: string
  projectId: string
}

export interface ProjectItemPhotoDeleteInput {
  itemId: string
  storagePath: string
}
