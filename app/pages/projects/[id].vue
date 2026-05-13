<script setup lang="ts">
import type {
  AutocompleteSuggestion,
  DataTableColumn,
  DataTableRow,
  TagInputSuggestion,
} from 'cindor-ui-core'
import {
  CindorActivityFeed,
  CindorActivityItem,
  CindorAutocomplete,
  CindorCard,
  CindorDataTable,
  CindorDescriptionItem,
  CindorDescriptionList,
  CindorDialog,
  CindorEmptyState,
  CindorFileInput,
  CindorFormField,
  CindorInput,
  CindorNumberInput,
  CindorOption,
  CindorPageHeader,
  CindorSelect,
  CindorTagInput,
  CindorTextarea,
} from 'cindor-ui-vue'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const {
  adjustProjectItemQuantity,
  createProjectItem,
  deleteProjectItemPhoto,
  deleteProjectItem,
  inviteProjectUser,
  isSupabaseConfigured,
  loadProjectData,
  revokeProjectInvite,
  uploadProjectItemPhoto,
  updateProjectItem,
} = useInventoryData()

const projectId = computed(() => String(route.params.id))

const { data, error, pending, refresh } = await useAsyncData(
  () => `project:${projectId.value}`,
  () => loadProjectData(projectId.value),
  {
    watch: [projectId],
  },
)

if (error.value) {
  throw error.value
}

const projectData = computed(() => data.value!)
const project = computed(() => projectData.value.project)
const items = computed(() => projectData.value.items)
const suggestions = computed(() => projectData.value.suggestions)
const availableTags = computed(() => projectData.value.availableTags)
const recentAdjustments = computed(() => projectData.value.recentAdjustments)
const members = computed(() => projectData.value.members)
const pendingInvites = computed(() => projectData.value.pendingInvites)
const canManageInventory = computed(() => isSupabaseConfigured.value && projectData.value.canEditProject)
const canManageInvites = computed(() => isSupabaseConfigured.value && projectData.value.canInviteUsers)
const tagInputSuggestions = computed<TagInputSuggestion[]>(() =>
  availableTags.value.map(tag => ({
    keywords: [tag.name.toLowerCase()],
    label: tag.name,
  })),
)

type InventoryTableActionKey = 'delete' | 'edit'

type InventoryTableRowActionDetail = {
  actionKey: InventoryTableActionKey
  rowId: string
}

type InventoryTableSearchChangeDetail = {
  matchingRows: number
  searchQuery: string
}

type InventoryTablePageChangeDetail = {
  currentPage: number
  totalPages: number
}

type InventoryTableSortDirection = 'ascending' | 'descending'

type InventoryTableSortChangeDetail = {
  sortDirection: InventoryTableSortDirection
  sortKey: string
}

type ValidatableFieldElement = HTMLElement & {
  focus: (options?: FocusOptions) => void
  reportValidity?: () => boolean
}

const INVENTORY_PAGE_SIZE = 50

const parsePositiveIntegerQuery = (value: unknown) => {
  if (typeof value !== 'string') {
    return 1
  }

  const parsedValue = Number.parseInt(value, 10)

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 1
}

const inventorySearchQuery = ref(typeof route.query.inventorySearch === 'string' ? route.query.inventorySearch : '')
const inventoryCurrentPage = ref(parsePositiveIntegerQuery(route.query.inventoryPage))
const inventorySortDirection = ref<InventoryTableSortDirection>('ascending')
const inventorySortKey = ref('name')

const updateProjectViewQuery = async (patch: Record<string, string | undefined>) => {
  const nextQuery: Record<string, string | string[] | null | undefined> = {
    ...route.query,
  }

  for (const [key, value] of Object.entries(patch)) {
    nextQuery[key] = value
  }

  for (const [key, value] of Object.entries(nextQuery)) {
    if (value == null || value === '') {
      delete nextQuery[key]
    }
  }

  await navigateTo(
    {
      path: route.path,
      query: nextQuery,
    },
    { replace: true },
  )
}

const focusField = async (field: ValidatableFieldElement | null) => {
  await nextTick()
  field?.focus()
  field?.reportValidity?.()
}

const inventoryTableRows = computed<DataTableRow[]>(() =>
  items.value.map(item => ({
    cost: item.cost ?? 'Not set',
    id: item.id,
    location: item.location ?? 'No location set',
    name: item.name,
    quantity: `${item.quantity} ${item.unit}`,
    quantityValue: item.quantity,
    status: item.isLowStock ? 'Low stock' : 'Healthy',
    threshold: `${item.threshold} ${item.unit}`,
    thresholdValue: item.threshold,
    vendor: item.vendor ?? 'Not set',
  })),
)

const inventoryTableColumns = computed<DataTableColumn[]>(() => [
  {
    cellSlot: 'item-cell',
    key: 'name',
    label: 'Item',
    sortable: true,
    sortValue: row => String(row.name),
  },
  {
    align: 'start',
    cellSlot: 'status-cell',
    key: 'status',
    label: 'Status',
    sortable: true,
  },
  {
    key: 'quantity',
    label: 'Quantity',
    numeric: true,
    sortable: true,
    sortValue: row => Number(row.quantityValue),
  },
  {
    key: 'threshold',
    label: 'Threshold',
    numeric: true,
    sortable: true,
    sortValue: row => Number(row.thresholdValue),
  },
  {
    key: 'location',
    label: 'Location',
    sortable: true,
  },
  {
    key: 'vendor',
    label: 'Vendor',
    sortable: true,
  },
  {
    key: 'cost',
    label: 'Cost',
    sortable: true,
  },
  {
    actions: [
      {
        disabled: !canManageInventory.value,
        key: 'edit',
        label: 'Edit',
      },
      {
        disabled: !canManageInventory.value || isDeletingItem.value,
        key: 'delete',
        label: 'Delete',
      },
    ],
    key: 'actions',
    label: 'Actions',
  },
])

const inventoryItemById = computed(() =>
  new Map(items.value.map(item => [item.id, item])),
)

const inventoryFilteredRows = computed(() => {
  const normalizedQuery = inventorySearchQuery.value.trim().toLowerCase()

  if (!normalizedQuery) {
    return inventoryTableRows.value
  }

  return inventoryTableRows.value.filter(row =>
    Object.entries(row)
      .filter(([key]) => key !== 'id' && !key.endsWith('Value'))
      .some(([, value]) => String(value).toLowerCase().includes(normalizedQuery)),
  )
})

const compareInventoryRowValues = (leftValue: number | string, rightValue: number | string) => {
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue
  }

  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

const inventoryVisibleItems = computed(() => {
  const sortedRows = [...inventoryFilteredRows.value].sort((leftRow, rightRow) => {
    let comparison = 0

    switch (inventorySortKey.value) {
      case 'quantity':
        comparison = compareInventoryRowValues(Number(leftRow.quantityValue), Number(rightRow.quantityValue))
        break
      case 'threshold':
        comparison = compareInventoryRowValues(Number(leftRow.thresholdValue), Number(rightRow.thresholdValue))
        break
      case 'status':
        comparison = compareInventoryRowValues(String(leftRow.status), String(rightRow.status))
        break
      case 'location':
        comparison = compareInventoryRowValues(String(leftRow.location), String(rightRow.location))
        break
      case 'vendor':
        comparison = compareInventoryRowValues(String(leftRow.vendor), String(rightRow.vendor))
        break
      case 'cost':
        comparison = compareInventoryRowValues(String(leftRow.cost), String(rightRow.cost))
        break
      default:
        comparison = compareInventoryRowValues(String(leftRow.name), String(rightRow.name))
        break
    }

    return inventorySortDirection.value === 'descending' ? comparison * -1 : comparison
  })

  const startIndex = (inventoryCurrentPage.value - 1) * INVENTORY_PAGE_SIZE

  return sortedRows
    .slice(startIndex, startIndex + INVENTORY_PAGE_SIZE)
    .map(row => inventoryItemById.value.get(String(row.id)))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

const formatPhotoFileSize = (value: number | null) => {
  if (!value || value <= 0) {
    return null
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.round(value / 1024)} KB`
}

const parseTagNames = (value: string | string[]) =>
  (Array.isArray(value) ? value : value.split(','))
    .map(tagName => tagName.trim())
    .filter(Boolean)

const splitTagSubmission = (tagNames: string[], existingTagIdByName: Map<string, string>) => {
  const existingTagIds: string[] = []
  const newTagNames: string[] = []
  const seenExistingTagIds = new Set<string>()
  const seenNewTagNames = new Set<string>()

  for (const tagName of tagNames) {
    const existingTagId = existingTagIdByName.get(tagName.toLowerCase())

    if (existingTagId) {
      if (!seenExistingTagIds.has(existingTagId)) {
        existingTagIds.push(existingTagId)
        seenExistingTagIds.add(existingTagId)
      }

      continue
    }

    const normalizedNewTagName = tagName.toLowerCase()

    if (!seenNewTagNames.has(normalizedNewTagName)) {
      newTagNames.push(tagName)
      seenNewTagNames.add(normalizedNewTagName)
    }
  }

  return {
    existingTagIds,
    newTagNames,
  }
}

const itemForm = reactive({
  cost: '',
  lowStockThreshold: '0',
  name: '',
  tags: [] as string[],
  notes: '',
  quantity: '0',
  storageLocation: '',
  unit: '',
  vendor: '',
})
const itemAutocompleteSuggestions = computed<AutocompleteSuggestion[]>(() =>
  suggestions.value.map(suggestion => ({
    description: suggestion.defaultUnit,
    label: suggestion.name,
    value: suggestion.name,
  })),
)
const existingItemsBySuggestedItemId = computed(() =>
  new Map(
    items.value
      .filter(item => typeof item.suggestedItemId === 'string' && item.suggestedItemId.length > 0)
      .map(item => [item.suggestedItemId!, item]),
  ),
)
const existingItemsByName = computed(() =>
  new Map(items.value.map(item => [item.name.trim().toLowerCase(), item])),
)

const matchedSuggestion = computed(() => {
  const normalizedName = itemForm.name.trim().toLowerCase()

  if (!normalizedName) {
    return null
  }

  return suggestions.value.find(suggestion => suggestion.name.toLowerCase() === normalizedName) ?? null
})

const getExistingItemForSuggestion = (suggestion: { id: string, name: string }) =>
  existingItemsBySuggestedItemId.value.get(suggestion.id)
  ?? existingItemsByName.value.get(suggestion.name.trim().toLowerCase())

watch(
  matchedSuggestion,
  value => {
    if (value && !itemForm.unit.trim()) {
      itemForm.unit = value.defaultUnit
    }
  },
)

const isCreatingItem = ref(false)
const createItemError = ref<string | null>(null)
const isCreateItemDialogOpen = ref(false)
const createItemAutocompleteKey = ref(0)
const createItemFieldErrors = reactive({
  name: '',
})
const createItemNameInput = ref<ValidatableFieldElement | null>(null)

const resetItemForm = () => {
  itemForm.cost = ''
  itemForm.lowStockThreshold = '0'
  itemForm.name = ''
  itemForm.tags = []
  itemForm.notes = ''
  itemForm.quantity = '0'
  itemForm.storageLocation = ''
  itemForm.unit = ''
  itemForm.vendor = ''
}

const prefillCreateItemForm = (suggestion?: { defaultUnit: string, name: string, tags: string[] } | null) => {
  resetItemForm()

  if (!suggestion) {
    return
  }

  itemForm.name = suggestion.name
  itemForm.tags = [...suggestion.tags]
  itemForm.unit = suggestion.defaultUnit
}

const prepareCreateItemDialog = (suggestion?: { defaultUnit: string, name: string, tags: string[] } | null) => {
  createItemError.value = null
  createItemFieldErrors.name = ''
  prefillCreateItemForm(suggestion)
  createItemAutocompleteKey.value += 1
  isEditItemDialogOpen.value = false
  isCreateItemDialogOpen.value = true
}

const openCreateItemDialog = async () => {
  prepareCreateItemDialog()
  await updateProjectViewQuery({
    inventoryDialog: 'create-item',
    inventoryItemId: undefined,
  })
}

const openCreateItemDialogForSuggestion = async (suggestion: { defaultUnit: string, name: string, tags: string[] }) => {
  prepareCreateItemDialog(suggestion)
  await updateProjectViewQuery({
    inventoryDialog: 'create-item',
    inventoryItemId: undefined,
  })
}

const handleSuggestedItemAction = async (suggestion: { defaultUnit: string, id: string, name: string, tags: string[] }) => {
  const existingItem = getExistingItemForSuggestion(suggestion)

  if (existingItem) {
    await openEditItemDialog(existingItem.id)
    return
  }

  await openCreateItemDialogForSuggestion(suggestion)
}

const validateCreateItemForm = async () => {
  createItemFieldErrors.name = ''

  if (!itemForm.name.trim()) {
    createItemFieldErrors.name = 'Enter an item name.'
    await focusField(createItemNameInput.value)
    return false
  }

  return true
}

const handleCreateItem = async () => {
  createItemError.value = null

  if (!await validateCreateItemForm()) {
    return
  }

  isCreatingItem.value = true

  try {
    const tagSubmission = splitTagSubmission(parseTagNames(itemForm.tags), availableTagIdByName.value)

    await createProjectItem({
      cost: itemForm.cost.trim() ? Number(itemForm.cost) : null,
      existingTagIds: tagSubmission.existingTagIds,
      lowStockThreshold: Number(itemForm.lowStockThreshold),
      name: itemForm.name.trim(),
      newTagNames: tagSubmission.newTagNames,
      notes: itemForm.notes.trim() || null,
      projectId: project.value.id,
      quantity: Number(itemForm.quantity),
      storageLocation: itemForm.storageLocation.trim() || null,
      suggestedItemId: matchedSuggestion.value?.id ?? null,
      unit: itemForm.unit.trim() || matchedSuggestion.value?.defaultUnit || 'units',
      vendor: itemForm.vendor.trim() || null,
    })

    resetItemForm()
    isCreateItemDialogOpen.value = false
    await refresh()
   }
  catch (submissionError) {
    createItemError.value = submissionError instanceof Error ? submissionError.message : 'Unable to add the item.'
  }
  finally {
    isCreatingItem.value = false
  }
}

const availableTagIdByName = computed(
  () => new Map(availableTags.value.map(tag => [tag.name.toLowerCase(), tag.id])),
)

const editForm = reactive({
  cost: '',
  itemId: '',
  lowStockThreshold: '0',
  name: '',
  tags: [] as string[],
  notes: '',
  quantity: '0',
  storageLocation: '',
  unit: '',
  vendor: '',
})

const selectedEditItem = computed(() => items.value.find(item => item.id === editForm.itemId) ?? null)

const matchedEditSuggestion = computed(() => {
  const normalizedName = editForm.name.trim().toLowerCase()

  if (!normalizedName) {
    return null
  }

  return suggestions.value.find(suggestion => suggestion.name.toLowerCase() === normalizedName) ?? null
})

watch(
  matchedEditSuggestion,
  value => {
    if (value && !editForm.unit.trim()) {
      editForm.unit = value.defaultUnit
    }
  },
)

const populateEditForm = (itemId: string) => {
  const item = items.value.find(currentItem => currentItem.id === itemId)

  if (!item) {
    return false
  }

  editForm.itemId = item.id
  editForm.cost = item.cost ? item.cost.replace(/[^0-9.-]/g, '') : ''
  editForm.lowStockThreshold = String(item.threshold)
  editForm.name = item.name
  editForm.tags = [...item.tags]
  editForm.notes = item.notes ?? ''
  editForm.quantity = String(item.quantity)
  editForm.storageLocation = item.location ?? ''
  editForm.unit = item.unit
  editForm.vendor = item.vendor ?? ''

  return true
}

const isSavingItemEdit = ref(false)
const editItemError = ref<string | null>(null)
const isDeletingItem = ref(false)
const isEditItemDialogOpen = ref(false)
const editItemFieldErrors = reactive({
  name: '',
})
const inventoryActionError = ref<string | null>(null)
const selectedPhotoFile = ref<File | null>(null)
const photoInputKey = ref(0)
const photoError = ref<string | null>(null)
const isUploadingPhoto = ref(false)
const isDeletingPhoto = ref(false)
const editItemNameInput = ref<ValidatableFieldElement | null>(null)

const resetEditForm = () => {
  editForm.cost = ''
  editForm.itemId = ''
  editForm.lowStockThreshold = '0'
  editForm.name = ''
  editForm.tags = []
  editForm.notes = ''
  editForm.quantity = '0'
  editForm.storageLocation = ''
  editForm.unit = ''
  editForm.vendor = ''
}

const prepareEditItemDialog = (itemId: string) => {
  inventoryActionError.value = null
  adjustmentError.value = null
  editItemError.value = null
  editItemFieldErrors.name = ''
  photoError.value = null
  selectedPhotoFile.value = null

  if (!populateEditForm(itemId)) {
    inventoryActionError.value = 'Unable to find that item.'
    return false
  }

  resetAdjustmentForm(itemId)
  isCreateItemDialogOpen.value = false
  isEditItemDialogOpen.value = true
  return true
}

const openEditItemDialog = async (itemId: string) => {
  if (!prepareEditItemDialog(itemId)) {
    return
  }

  await updateProjectViewQuery({
    inventoryDialog: 'edit-item',
    inventoryItemId: itemId,
  })
}

const validateEditItemForm = async () => {
  editItemFieldErrors.name = ''

  if (!editForm.name.trim()) {
    editItemFieldErrors.name = 'Enter an item name.'
    await focusField(editItemNameInput.value)
    return false
  }

  return true
}

const handleUpdateItem = async () => {
  editItemError.value = null

  if (!await validateEditItemForm()) {
    return
  }

  isSavingItemEdit.value = true

  try {
    const tagSubmission = splitTagSubmission(parseTagNames(editForm.tags), availableTagIdByName.value)

    await updateProjectItem({
      cost: editForm.cost.trim() ? Number(editForm.cost) : null,
      existingTagIds: tagSubmission.existingTagIds,
      itemId: editForm.itemId,
      lowStockThreshold: Number(editForm.lowStockThreshold),
      name: editForm.name.trim(),
      newTagNames: tagSubmission.newTagNames,
      notes: editForm.notes.trim() || null,
      quantity: Number(editForm.quantity),
      storageLocation: editForm.storageLocation.trim() || null,
      suggestedItemId: matchedEditSuggestion.value?.id ?? selectedEditItem.value?.suggestedItemId ?? null,
      unit: editForm.unit.trim() || matchedEditSuggestion.value?.defaultUnit || 'units',
      vendor: editForm.vendor.trim() || null,
    })

    isEditItemDialogOpen.value = false
    await refresh()
  }
  catch (submissionError) {
    editItemError.value = submissionError instanceof Error ? submissionError.message : 'Unable to save the item.'
  }
  finally {
    isSavingItemEdit.value = false
  }
}

const handleDeleteItem = async (itemId = editForm.itemId) => {
  const item = items.value.find(currentItem => currentItem.id === itemId)

  if (!itemId || !item) {
    inventoryActionError.value = 'Unable to find that item.'
    return
  }

  if (process.client && !window.confirm(`Delete ${item.name} from the project? This also removes its tag links and adjustment history.`)) {
    return
  }

  editItemError.value = null
  inventoryActionError.value = null
  isDeletingItem.value = true

  try {
    await deleteProjectItem(itemId)
    isEditItemDialogOpen.value = false
    await refresh()
  }
  catch (submissionError) {
    const message = submissionError instanceof Error ? submissionError.message : 'Unable to delete the item.'

    if (editForm.itemId === itemId) {
      editItemError.value = message
    }
    else {
      inventoryActionError.value = message
    }
  }
  finally {
    isDeletingItem.value = false
  }
}

const handlePhotoSelection = (files: FileList | null) => {
  selectedPhotoFile.value = files?.[0] ?? null
}

const resetPhotoSelection = () => {
  selectedPhotoFile.value = null
  photoInputKey.value += 1
}

const handleUploadPhoto = async () => {
  if (!selectedEditItem.value) {
    photoError.value = 'Select an item before uploading a photo.'
    return
  }

  if (!selectedPhotoFile.value) {
    photoError.value = 'Choose an image file before uploading.'
    return
  }

  photoError.value = null
  isUploadingPhoto.value = true

  try {
    await uploadProjectItemPhoto({
      existingStoragePath: selectedEditItem.value.photo?.storagePath ?? null,
      file: selectedPhotoFile.value,
      itemId: selectedEditItem.value.id,
      projectId: project.value.id,
    })

    resetPhotoSelection()
    await refresh()
  }
  catch (submissionError) {
    photoError.value = submissionError instanceof Error ? submissionError.message : 'Unable to upload the item photo.'
  }
  finally {
    isUploadingPhoto.value = false
  }
}

const handleDeletePhoto = async () => {
  if (!selectedEditItem.value?.photo) {
    photoError.value = 'Select an item photo before deleting it.'
    return
  }

  if (process.client && !window.confirm('Delete this item photo?')) {
    return
  }

  photoError.value = null
  isDeletingPhoto.value = true

  try {
    await deleteProjectItemPhoto({
      itemId: selectedEditItem.value.id,
      storagePath: selectedEditItem.value.photo.storagePath,
    })

    resetPhotoSelection()
    await refresh()
  }
  catch (submissionError) {
    photoError.value = submissionError instanceof Error ? submissionError.message : 'Unable to delete the item photo.'
  }
  finally {
    isDeletingPhoto.value = false
  }
}

watch(isCreateItemDialogOpen, value => {
  if (!value) {
    createItemError.value = null
    createItemFieldErrors.name = ''
    resetItemForm()

    if (route.query.inventoryDialog === 'create-item') {
      void updateProjectViewQuery({
        inventoryDialog: undefined,
        inventoryItemId: undefined,
      })
    }
  }
})

watch(isEditItemDialogOpen, value => {
  if (!value) {
    adjustmentError.value = null
    adjustmentFieldErrors.delta = ''
    editItemError.value = null
    editItemFieldErrors.name = ''
    photoError.value = null
    resetAdjustmentForm()
    resetEditForm()
    resetPhotoSelection()

    if (route.query.inventoryDialog === 'edit-item') {
      void updateProjectViewQuery({
        inventoryDialog: undefined,
        inventoryItemId: undefined,
      })
    }
  }
})

watch(
  () => [route.query.inventoryDialog, route.query.inventoryItemId] as const,
  ([nextDialog, nextItemId]) => {
    if (nextDialog === 'create-item') {
      if (!isCreateItemDialogOpen.value) {
        prepareCreateItemDialog()
      }

      return
    }

    if (nextDialog === 'edit-item' && typeof nextItemId === 'string') {
      if (!isEditItemDialogOpen.value || editForm.itemId !== nextItemId) {
        if (!prepareEditItemDialog(nextItemId)) {
          void updateProjectViewQuery({
            inventoryDialog: undefined,
            inventoryItemId: undefined,
          })
        }
      }

      return
    }

    if (isCreateItemDialogOpen.value) {
      isCreateItemDialogOpen.value = false
    }

    if (isEditItemDialogOpen.value) {
      isEditItemDialogOpen.value = false
    }
  },
  { immediate: true },
)

const handleInventoryRowAction = async (event: CustomEvent<InventoryTableRowActionDetail>) => {
  if (event.detail.actionKey === 'edit') {
    await openEditItemDialog(event.detail.rowId)
    return
  }

  if (event.detail.actionKey === 'delete') {
    await handleDeleteItem(event.detail.rowId)
  }
}

const adjustmentForm = reactive({
  delta: '1',
  itemId: '',
  note: '',
  reason: 'correction' as const,
})

const adjustmentReasonOptions = [
  { label: 'Restock', value: 'restock' },
  { label: 'Usage', value: 'usage' },
  { label: 'Correction', value: 'correction' },
  { label: 'Inventory count', value: 'inventory_count' },
  { label: 'Other', value: 'other' },
] as const

const isAdjustingItem = ref(false)
const adjustmentError = ref<string | null>(null)
const adjustmentFieldErrors = reactive({
  delta: '',
})
const isSendingInvite = ref(false)
const inviteError = ref<string | null>(null)
const inviteSuccess = ref<string | null>(null)
const activeInviteId = ref<string | null>(null)
const inviteFieldErrors = reactive({
  email: '',
})
const inviteForm = reactive({
  email: '',
  role: 'viewer' as const,
})
const inviteEmailInput = ref<ValidatableFieldElement | null>(null)
const adjustmentDeltaInput = ref<ValidatableFieldElement | null>(null)
const inviteRoleOptions = [
  { label: 'Viewer', value: 'viewer' },
  { label: 'Editor', value: 'editor' },
] as const

const resetAdjustmentForm = (itemId = '') => {
  adjustmentForm.delta = '1'
  adjustmentForm.itemId = itemId
  adjustmentForm.note = ''
  adjustmentForm.reason = 'correction'
}

const validateAdjustmentForm = async () => {
  adjustmentFieldErrors.delta = ''

  if (!adjustmentForm.itemId) {
    adjustmentError.value = 'Select an item before saving an adjustment.'
    return false
  }

  if (!Number.isFinite(Number(adjustmentForm.delta)) || Number(adjustmentForm.delta) === 0) {
    adjustmentFieldErrors.delta = 'Enter a quantity change other than 0.'
    await focusField(adjustmentDeltaInput.value)
    return false
  }

  return true
}

const handleAdjustQuantity = async () => {
  adjustmentError.value = null

  if (!await validateAdjustmentForm()) {
    return
  }

  isAdjustingItem.value = true

  try {
    await adjustProjectItemQuantity({
      delta: Number(adjustmentForm.delta),
      itemId: adjustmentForm.itemId,
      note: adjustmentForm.note.trim() || null,
      reason: adjustmentForm.reason,
    })

    resetAdjustmentForm(adjustmentForm.itemId)
    await refresh()
  }
  catch (submissionError) {
    adjustmentError.value = submissionError instanceof Error ? submissionError.message : 'Unable to adjust the quantity.'
  }
  finally {
    isAdjustingItem.value = false
  }
}

const validateInviteForm = async () => {
  inviteFieldErrors.email = ''

  const normalizedEmail = inviteForm.email.trim()

  if (!normalizedEmail) {
    inviteFieldErrors.email = 'Enter an email address.'
    await focusField(inviteEmailInput.value)
    return false
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    inviteFieldErrors.email = 'Enter a valid email address, for example maker@example.com.'
    await focusField(inviteEmailInput.value)
    return false
  }

  return true
}

const handleSendInvite = async () => {
  inviteError.value = null
  inviteSuccess.value = null

  if (!await validateInviteForm()) {
    return
  }

  isSendingInvite.value = true

  try {
    await inviteProjectUser(project.value.id, {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
    })

    inviteForm.email = ''
    inviteForm.role = 'viewer'
    inviteSuccess.value = 'Invitation sent.'
    await refresh()
  }
  catch (submissionError) {
    inviteError.value = submissionError instanceof Error ? submissionError.message : 'Unable to send the invite.'
  }
  finally {
    isSendingInvite.value = false
  }
}

const handleRevokeInvite = async (inviteId: string) => {
  inviteError.value = null
  inviteSuccess.value = null
  activeInviteId.value = inviteId

  try {
    await revokeProjectInvite(inviteId)
    inviteSuccess.value = 'Invitation revoked.'
    await refresh()
  }
  catch (submissionError) {
    inviteError.value = submissionError instanceof Error ? submissionError.message : 'Unable to revoke the invite.'
  }
  finally {
    activeInviteId.value = null
  }
}

watch(() => route.query.inventorySearch, value => {
  inventorySearchQuery.value = typeof value === 'string' ? value : ''
})

watch(() => route.query.inventoryPage, value => {
  inventoryCurrentPage.value = parsePositiveIntegerQuery(value)
})

watch(inventoryFilteredRows, rows => {
  const maxPage = Math.max(1, Math.ceil(rows.length / INVENTORY_PAGE_SIZE))

  if (inventoryCurrentPage.value > maxPage) {
    inventoryCurrentPage.value = maxPage

    void updateProjectViewQuery({
      inventoryPage: maxPage > 1 ? String(maxPage) : undefined,
    })
  }
})

watch(() => inviteForm.email, () => {
  if (inviteFieldErrors.email) {
    inviteFieldErrors.email = ''
  }
})

watch(() => itemForm.name, () => {
  if (createItemFieldErrors.name) {
    createItemFieldErrors.name = ''
  }
})

watch(() => editForm.name, () => {
  if (editItemFieldErrors.name) {
    editItemFieldErrors.name = ''
  }
})

watch(() => adjustmentForm.delta, () => {
  if (adjustmentFieldErrors.delta) {
    adjustmentFieldErrors.delta = ''
  }
})

const handleInventorySearchChange = async (event: CustomEvent<InventoryTableSearchChangeDetail>) => {
  inventorySearchQuery.value = event.detail.searchQuery
  inventoryCurrentPage.value = 1

  await updateProjectViewQuery({
    inventoryPage: undefined,
    inventorySearch: event.detail.searchQuery || undefined,
  })
}

const handleInventoryPageChange = async (event: CustomEvent<InventoryTablePageChangeDetail>) => {
  inventoryCurrentPage.value = event.detail.currentPage

  await updateProjectViewQuery({
    inventoryPage: event.detail.currentPage > 1 ? String(event.detail.currentPage) : undefined,
  })
}

const handleInventorySortChange = (event: CustomEvent<InventoryTableSortChangeDetail>) => {
  inventorySortDirection.value = event.detail.sortDirection
  inventorySortKey.value = event.detail.sortKey
}
</script>

<template>
  <div class="page-stack">
    <CindorCard v-if="pending">
      <cindor-spinner />
    </CindorCard>

    <template v-else>
      <CindorCard>
        <CindorPageHeader
          :description="project.summary"
          :eyebrow="project.typeLabel"
          :title="project.name"
        >
          <cindor-badge slot="meta" :tone="project.lowStockCount > 0 ? 'accent' : 'success'">
            {{ project.lowStockCount }} low stock
          </cindor-badge>
        </CindorPageHeader>

        <div v-if="project.tags.length > 0" class="tag-list">
          <cindor-chip
            v-for="tag in project.tags"
            :key="tag"
            tone="neutral"
          >
            {{ tag }}
          </cindor-chip>
        </div>

        <CindorDescriptionList>
          <CindorDescriptionItem>
            <span slot="term">Collaborators</span>
            {{ project.memberCount }}
          </CindorDescriptionItem>
          <CindorDescriptionItem>
            <span slot="term">Items</span>
            {{ project.itemCount }}
          </CindorDescriptionItem>
          <CindorDescriptionItem>
            <span slot="term">Updated</span>
            {{ project.lastUpdated }}
          </CindorDescriptionItem>
          <CindorDescriptionItem v-if="project.membershipRole">
            <span slot="term">Role</span>
            {{ project.membershipRole }}
          </CindorDescriptionItem>
        </CindorDescriptionList>
      </CindorCard>

      <section class="detail-grid project-detail-grid">
        <CindorCard>
          <CindorPageHeader
            description="Photos, quantity, storage, vendor, cost, notes, tags, and threshold."
            title="Project inventory"
          >
            <cindor-button
              v-if="projectData.canEditProject"
              slot="actions"
              :disabled="!isSupabaseConfigured"
              @click="openCreateItemDialog"
            >
              Add item
            </cindor-button>
          </CindorPageHeader>

          <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
            Add your Supabase environment variables before creating live project items.
          </cindor-alert>

          <cindor-alert v-else-if="!projectData.canEditProject" tone="warning">
            You are a viewer on this project, so inventory edits are disabled.
          </cindor-alert>

          <cindor-alert v-if="inventoryActionError" tone="danger">
            {{ inventoryActionError }}
          </cindor-alert>

          <CindorDataTable
            v-if="items.length > 0"
            caption="Project inventory"
            :columns="inventoryTableColumns"
            :current-page="inventoryCurrentPage"
            empty-message="This project has no items yet."
            :page-size="INVENTORY_PAGE_SIZE"
            row-id-key="id"
            :rows="inventoryTableRows"
            :search-query="inventorySearchQuery"
            searchable
            search-placeholder="Search project inventory…"
            :sort-direction="inventorySortDirection"
            :sort-key="inventorySortKey"
            @page-change="handleInventoryPageChange"
            @row-action="handleInventoryRowAction"
            @search-change="handleInventorySearchChange"
            @sort-change="handleInventorySortChange"
          >
            <div
              v-for="item in inventoryVisibleItems"
              :key="`item-cell-${item.id}`"
              :slot="`item-cell-${item.id}`"
              class="item-photo-summary"
            >
              <strong>{{ item.name }}</strong>
              <div v-if="item.photo" class="item-photo-summary">
                <img
                  :src="item.photo.url"
                  :alt="`${item.name} photo`"
                  class="item-photo-summary__image"
                  height="140"
                  width="140"
                >
                <div class="helper-text">
                  {{ item.photo.mimeType ?? 'Image' }}
                  <span v-if="formatPhotoFileSize(item.photo.fileSizeBytes)">
                    · {{ formatPhotoFileSize(item.photo.fileSizeBytes) }}
                  </span>
                </div>
              </div>
              <div v-if="item.notes" class="muted">{{ item.notes }}</div>
              <div v-if="item.tags.length > 0" class="tag-list">
                <cindor-chip
                  v-for="tag in item.tags"
                  :key="tag"
                  tone="neutral"
                >
                  {{ tag }}
                </cindor-chip>
              </div>
            </div>

            <cindor-badge
              v-for="item in inventoryVisibleItems"
              :key="`status-cell-${item.id}`"
              :slot="`status-cell-${item.id}`"
              :tone="item.isLowStock ? 'accent' : 'success'"
            >
              {{ item.isLowStock ? 'Low stock' : 'Healthy' }}
            </cindor-badge>
          </CindorDataTable>

          <CindorEmptyState v-else>
            <div>
              <h3>No items yet</h3>
              <p>Use Add item to create the first entry for this project.</p>
            </div>
          </CindorEmptyState>
        </CindorCard>

        <div class="page-stack">
          <CindorCard>
            <CindorPageHeader
              description="Owners can invite editors and viewers by email."
              title="Collaborators"
            />

            <cindor-alert v-if="inviteError" tone="danger">
              {{ inviteError }}
            </cindor-alert>

            <cindor-alert v-if="inviteSuccess" tone="success">
              {{ inviteSuccess }}
            </cindor-alert>

            <form v-if="canManageInvites" class="form-grid" @submit.prevent="handleSendInvite">
              <div class="field-grid">
                <CindorFormField :error="inviteFieldErrors.email" label="Email" required>
                  <CindorInput
                    ref="inviteEmailInput"
                    v-model="inviteForm.email"
                    autocomplete="email"
                    maxlength="320"
                    name="invite-email"
                    placeholder="maker@example.com"
                    required
                    spellcheck="false"
                    type="email"
                  />
                </CindorFormField>

                <CindorFormField label="Role">
                  <CindorSelect v-model="inviteForm.role" autocomplete="off" name="invite-role">
                    <CindorOption
                      v-for="option in inviteRoleOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </CindorOption>
                  </CindorSelect>
                </CindorFormField>
              </div>

              <div class="button-row">
                <cindor-button
                  :disabled="isSendingInvite"
                  type="submit"
                >
                  {{ isSendingInvite ? 'Sending invite…' : 'Send invite' }}
                </cindor-button>
              </div>
            </form>

            <cindor-alert v-else-if="project.membershipRole === 'editor'" tone="info">
              Only the project owner can invite collaborators.
            </cindor-alert>

            <div class="page-stack">
              <div>
                <strong>Current members</strong>
                <div v-if="members.length > 0" class="member-list">
                  <CindorCard
                    v-for="member in members"
                    :key="member.userId"
                  >
                    <div class="row-between">
                      <div class="page-stack member-summary">
                        <strong>{{ member.fullName || member.email }}</strong>
                        <span class="helper-text">{{ member.email }}</span>
                        <span class="helper-text">Joined {{ member.joinedAtLabel }}</span>
                      </div>
                      <cindor-badge tone="neutral">
                        {{ member.role }}
                      </cindor-badge>
                    </div>
                  </CindorCard>
                </div>
                <div v-else class="helper-text">
                  No collaborators have joined this project yet.
                </div>
              </div>

              <div>
                <strong>Pending invites</strong>
                <div v-if="pendingInvites.length > 0" class="member-list">
                  <CindorCard
                    v-for="invite in pendingInvites"
                    :key="invite.id"
                  >
                    <div class="page-stack member-summary">
                      <div class="row-between">
                        <div class="page-stack member-summary">
                          <strong>{{ invite.recipientName || invite.email }}</strong>
                          <span class="helper-text">{{ invite.email }}</span>
                        </div>
                        <cindor-badge tone="accent">
                          {{ invite.role }}
                        </cindor-badge>
                      </div>
                      <span class="helper-text">Invited {{ invite.invitedAtLabel }} · Expires {{ invite.expiresAtLabel }}</span>
                      <div v-if="canManageInvites" class="button-row">
                        <cindor-button
                          :disabled="activeInviteId === invite.id"
                          type="button"
                          variant="ghost"
                          @click="handleRevokeInvite(invite.id)"
                        >
                          {{ activeInviteId === invite.id ? 'Revoking…' : 'Revoke invite' }}
                        </cindor-button>
                      </div>
                    </div>
                  </CindorCard>
                </div>
                <div v-else class="helper-text">
                  No pending invites right now.
                </div>
              </div>
            </div>
          </CindorCard>

          <CindorCard>
            <CindorPageHeader
              description="Most recent quantity changes for this project."
              title="Recent adjustments"
            />

            <CindorActivityFeed v-if="recentAdjustments.length > 0">
              <CindorActivityItem
                v-for="adjustment in recentAdjustments"
                :key="adjustment.id"
              >
                <span slot="title">{{ adjustment.itemName }}</span>
                <span slot="timestamp">{{ adjustment.createdAtLabel }}</span>
                <span slot="meta">{{ adjustment.reason }} · new quantity {{ adjustment.newQuantity }}</span>
                <cindor-badge
                  slot="actions"
                  :tone="adjustment.delta > 0 ? 'success' : 'accent'"
                >
                  {{ adjustment.delta > 0 ? '+' : '' }}{{ adjustment.delta }}
                </cindor-badge>
                {{ adjustment.note || 'Quantity change recorded.' }}
              </CindorActivityItem>
            </CindorActivityFeed>

            <CindorEmptyState v-else>
              <div>
                <h3>No quantity changes yet</h3>
                <p>No quantity changes have been recorded for this project yet.</p>
              </div>
            </CindorEmptyState>
          </CindorCard>

          <CindorCard>
            <CindorPageHeader
              :description="`Built-in list for ${project.typeLabel}.`"
              title="Suggested items"
            />

            <div v-if="suggestions.length > 0" class="suggestion-list">
              <CindorCard
                v-for="suggestion in suggestions"
                :key="suggestion.id"
              >
                <CindorPageHeader
                  :description="`Default unit: ${suggestion.defaultUnit}`"
                  :title="suggestion.name"
                >
                  <cindor-button
                    v-if="canManageInventory"
                    slot="actions"
                    variant="ghost"
                    @click="handleSuggestedItemAction(suggestion)"
                  >
                    {{ getExistingItemForSuggestion(suggestion) ? 'Edit item' : 'Add item' }}
                  </cindor-button>
                  <cindor-badge slot="meta" tone="neutral">{{ suggestion.defaultUnit }}</cindor-badge>
                  <cindor-badge
                    v-if="getExistingItemForSuggestion(suggestion)"
                    slot="meta"
                    tone="success"
                  >
                    Added
                  </cindor-badge>
                </CindorPageHeader>

                <div v-if="suggestion.tags.length > 0" class="tag-list">
                  <cindor-chip
                    v-for="tag in suggestion.tags"
                    :key="`${suggestion.id}-${tag}`"
                    tone="neutral"
                  >
                    {{ tag }}
                  </cindor-chip>
                </div>
              </CindorCard>
            </div>

            <CindorEmptyState v-else>
              <div>
                <h3>No built-in suggestions</h3>
                <p>No built-in suggestions are available for this project type yet.</p>
              </div>
            </CindorEmptyState>
          </CindorCard>
        </div>
      </section>

      <CindorDialog v-model:open="isCreateItemDialogOpen" modal>
        <div class="item-dialog page-stack">
          <CindorPageHeader
            description="Autocomplete uses the built-in project-type suggestions."
            title="Add item"
          />

          <cindor-alert v-if="createItemError" tone="danger">
            {{ createItemError }}
          </cindor-alert>

          <form class="form-grid" @submit.prevent="handleCreateItem">
            <CindorFormField
              description="Start typing a suggested item or enter a new one."
              :error="createItemFieldErrors.name"
              label="Item name"
              required
            >
              <CindorAutocomplete
                :key="createItemAutocompleteKey"
                ref="createItemNameInput"
                v-model="itemForm.name"
                autocomplete="off"
                maxlength="120"
                name="item-name"
                placeholder="Start typing a suggested item, for example Cotton Yarn…"
                required
                :suggestions="itemAutocompleteSuggestions"
              />
            </CindorFormField>

            <div class="field-grid">
              <CindorFormField label="Quantity">
                <CindorNumberInput
                  v-model="itemForm.quantity"
                  autocomplete="off"
                  min="0"
                  name="item-quantity"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Unit">
                <CindorInput
                  v-model="itemForm.unit"
                  autocomplete="off"
                  maxlength="20"
                  name="item-unit"
                  placeholder="For example, skeins, packs, or yards…"
                />
              </CindorFormField>

              <CindorFormField label="Low-stock threshold">
                <CindorNumberInput
                  v-model="itemForm.lowStockThreshold"
                  autocomplete="off"
                  min="0"
                  name="item-threshold"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Cost">
                <CindorNumberInput
                  v-model="itemForm.cost"
                  autocomplete="off"
                  min="0"
                  name="item-cost"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Storage location">
                <CindorInput
                  v-model="itemForm.storageLocation"
                  autocomplete="off"
                  maxlength="120"
                  name="item-location"
                  placeholder="For example, shelf, drawer, or bin…"
                />
              </CindorFormField>

              <CindorFormField label="Vendor/source">
                <CindorInput
                  v-model="itemForm.vendor"
                  autocomplete="off"
                  maxlength="120"
                  name="item-vendor"
                  placeholder="For example, Local Yarn Shop…"
                />
              </CindorFormField>
            </div>

            <CindorFormField
              :description="availableTags.length > 0 ? 'Press Enter after each tag. Known project tags are matched automatically.' : 'Press Enter after each tag name.'"
              label="Tags"
            >
              <CindorTagInput
                v-model="itemForm.tags"
                autocomplete="off"
                maxlength="200"
                name="item-tags"
                placeholder="For example, yarn, gift, or wool…"
                :suggestions="tagInputSuggestions"
              />
            </CindorFormField>

            <CindorFormField label="Notes">
              <CindorTextarea
                v-model="itemForm.notes"
                autocomplete="off"
                maxlength="500"
                name="item-notes"
                placeholder="For example, blue dye lot or restock in June…"
              />
            </CindorFormField>

            <div class="button-row">
              <cindor-button
                :disabled="!canManageInventory || isCreatingItem"
                type="submit"
              >
                {{ isCreatingItem ? 'Adding item…' : 'Add item' }}
              </cindor-button>
              <cindor-button
                type="button"
                variant="ghost"
                @click="isCreateItemDialogOpen = false"
              >
                Cancel
              </cindor-button>
            </div>
          </form>
        </div>
      </CindorDialog>

      <CindorDialog v-model:open="isEditItemDialogOpen" modal>
        <div class="item-dialog item-dialog--wide page-stack">
          <CindorPageHeader
            description="Update item details, tags, and photos without leaving the project."
            title="Edit item"
          />

          <cindor-alert v-if="editItemError" tone="danger">
            {{ editItemError }}
          </cindor-alert>

          <cindor-alert v-if="photoError" tone="danger">
            {{ photoError }}
          </cindor-alert>

          <form v-if="selectedEditItem" class="form-grid" @submit.prevent="handleUpdateItem">
            <CindorFormField :error="editItemFieldErrors.name" label="Item name" required>
              <CindorAutocomplete
                ref="editItemNameInput"
                v-model="editForm.name"
                autocomplete="off"
                maxlength="120"
                name="edit-item-name"
                required
                :suggestions="itemAutocompleteSuggestions"
              />
            </CindorFormField>

            <div class="field-grid">
              <CindorFormField label="Quantity">
                <CindorNumberInput
                  v-model="editForm.quantity"
                  autocomplete="off"
                  min="0"
                  name="edit-item-quantity"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Unit">
                <CindorInput
                  v-model="editForm.unit"
                  autocomplete="off"
                  maxlength="20"
                  name="edit-item-unit"
                />
              </CindorFormField>

              <CindorFormField label="Low-stock threshold">
                <CindorNumberInput
                  v-model="editForm.lowStockThreshold"
                  autocomplete="off"
                  min="0"
                  name="edit-item-threshold"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Cost">
                <CindorNumberInput
                  v-model="editForm.cost"
                  autocomplete="off"
                  min="0"
                  name="edit-item-cost"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Storage location">
                <CindorInput
                  v-model="editForm.storageLocation"
                  autocomplete="off"
                  maxlength="120"
                  name="edit-item-location"
                />
              </CindorFormField>

              <CindorFormField label="Vendor/source">
                <CindorInput
                  v-model="editForm.vendor"
                  autocomplete="off"
                  maxlength="120"
                  name="edit-item-vendor"
                />
              </CindorFormField>
            </div>

            <CindorFormField
              :description="availableTags.length > 0 ? 'Press Enter after each tag. Known project tags are matched automatically.' : 'Press Enter after each tag name.'"
              label="Tags"
            >
              <CindorTagInput
                v-model="editForm.tags"
                autocomplete="off"
                maxlength="200"
                name="edit-item-tags"
                placeholder="For example, yarn, gift, or wool…"
                :suggestions="tagInputSuggestions"
              />
            </CindorFormField>

            <CindorFormField label="Notes">
              <CindorTextarea
                v-model="editForm.notes"
                autocomplete="off"
                maxlength="500"
                name="edit-item-notes"
              />
            </CindorFormField>

            <CindorFormField
              :description="selectedEditItem.photo ? '' : 'No photo has been uploaded for this item yet.'"
              label="Photo"
            >
              <div v-if="selectedEditItem.photo" class="item-photo-panel">
                <img
                  :src="selectedEditItem.photo.url"
                  :alt="`${selectedEditItem.name} photo`"
                  class="item-photo-panel__image"
                  height="140"
                  width="140"
                >
                <div class="helper-text">
                  {{ selectedEditItem.photo.mimeType ?? 'Image' }}
                  <span v-if="formatPhotoFileSize(selectedEditItem.photo.fileSizeBytes)">
                    · {{ formatPhotoFileSize(selectedEditItem.photo.fileSizeBytes) }}
                  </span>
                </div>
              </div>
              <CindorFileInput
                :key="photoInputKey"
                accept="image/jpeg,image/png,image/webp"
                name="edit-item-photo"
                @update:files="handlePhotoSelection"
              />
              <div class="button-row">
                <cindor-button
                  :disabled="!canManageInventory || isUploadingPhoto || !selectedEditItem || !selectedPhotoFile"
                  type="button"
                  @click="handleUploadPhoto"
                >
                  {{ isUploadingPhoto ? 'Uploading photo…' : (selectedEditItem.photo ? 'Replace photo' : 'Upload photo') }}
                </cindor-button>
                <cindor-button
                  :disabled="!canManageInventory || isDeletingPhoto || !selectedEditItem.photo"
                  type="button"
                  variant="ghost"
                  @click="handleDeletePhoto"
                >
                  {{ isDeletingPhoto ? 'Deleting photo…' : 'Delete photo' }}
                </cindor-button>
              </div>
            </CindorFormField>

            <div class="button-row">
              <cindor-button
                :disabled="!canManageInventory || isSavingItemEdit || !editForm.itemId"
                type="submit"
              >
                {{ isSavingItemEdit ? 'Saving item…' : 'Save item changes' }}
              </cindor-button>
              <cindor-button
                :disabled="!canManageInventory || isDeletingItem || !editForm.itemId"
                type="button"
                variant="ghost"
                @click="handleDeleteItem()"
              >
                {{ isDeletingItem ? 'Deleting item…' : 'Delete item' }}
              </cindor-button>
              <cindor-button
                type="button"
                variant="ghost"
                @click="isEditItemDialogOpen = false"
              >
                Cancel
              </cindor-button>
            </div>
          </form>

          <CindorPageHeader
            description="Record a quantity change without leaving the edit flow."
            title="Adjust quantity"
          />

          <cindor-alert v-if="adjustmentError" tone="danger">
            {{ adjustmentError }}
          </cindor-alert>

          <form class="form-grid" @submit.prevent="handleAdjustQuantity">
            <div class="field-grid">
              <CindorFormField :error="adjustmentFieldErrors.delta" label="Delta">
                <CindorNumberInput
                  ref="adjustmentDeltaInput"
                  v-model="adjustmentForm.delta"
                  autocomplete="off"
                  name="adjust-delta"
                  step="0.01"
                />
              </CindorFormField>

              <CindorFormField label="Reason">
                <CindorSelect
                  v-model="adjustmentForm.reason"
                  autocomplete="off"
                  name="adjust-reason"
                >
                  <CindorOption
                    v-for="option in adjustmentReasonOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </CindorOption>
                </CindorSelect>
              </CindorFormField>
            </div>

            <CindorFormField label="Note">
              <CindorTextarea
                v-model="adjustmentForm.note"
                autocomplete="off"
                maxlength="300"
                name="adjust-note"
                placeholder="For example, counted remaining stock after class…"
              />
            </CindorFormField>

            <div class="button-row">
              <cindor-button
                :disabled="!canManageInventory || isAdjustingItem || !adjustmentForm.itemId"
                type="submit"
              >
                {{ isAdjustingItem ? 'Saving adjustment…' : 'Save adjustment' }}
              </cindor-button>
            </div>
          </form>
        </div>
      </CindorDialog>
    </template>
  </div>
</template>
