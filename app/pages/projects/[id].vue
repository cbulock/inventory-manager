<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const {
  adjustProjectItemQuantity,
  createProjectItem,
  deleteProjectItemPhoto,
  deleteProjectItem,
  isSupabaseConfigured,
  loadProjectData,
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

const formatPhotoFileSize = (value: number | null) => {
  if (!value || value <= 0) {
    return null
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${Math.round(value / 1024)} KB`
}

const parseTagNames = (value: string) =>
  value
    .split(',')
    .map(tagName => tagName.trim())
    .filter(Boolean)

const itemForm = reactive({
  cost: '',
  lowStockThreshold: 0,
  name: '',
  newTags: '',
  notes: '',
  quantity: 0,
  storageLocation: '',
  unit: '',
  vendor: '',
})

const selectedTagIds = ref<string[]>([])
const itemSuggestionNames = computed(() => suggestions.value.map(suggestion => suggestion.name))

const matchedSuggestion = computed(() => {
  const normalizedName = itemForm.name.trim().toLowerCase()

  if (!normalizedName) {
    return null
  }

  return suggestions.value.find(suggestion => suggestion.name.toLowerCase() === normalizedName) ?? null
})

watch(
  matchedSuggestion,
  value => {
    if (value && !itemForm.unit.trim()) {
      itemForm.unit = value.defaultUnit
    }
  },
)

const isSelectedTag = (tagId: string) => selectedTagIds.value.includes(tagId)

const toggleTag = (tagId: string) => {
  if (isSelectedTag(tagId)) {
    selectedTagIds.value = selectedTagIds.value.filter(selectedId => selectedId !== tagId)
    return
  }

  selectedTagIds.value = [...selectedTagIds.value, tagId]
}

const isCreatingItem = ref(false)
const createItemError = ref<string | null>(null)

const resetItemForm = () => {
  itemForm.cost = ''
  itemForm.lowStockThreshold = 0
  itemForm.name = ''
  itemForm.newTags = ''
  itemForm.notes = ''
  itemForm.quantity = 0
  itemForm.storageLocation = ''
  itemForm.unit = ''
  itemForm.vendor = ''
  selectedTagIds.value = []
}

const handleCreateItem = async () => {
  createItemError.value = null
  isCreatingItem.value = true

  try {
    await createProjectItem({
      cost: itemForm.cost.trim() ? Number(itemForm.cost) : null,
      existingTagIds: selectedTagIds.value,
      lowStockThreshold: Number(itemForm.lowStockThreshold),
      name: itemForm.name,
      newTagNames: parseTagNames(itemForm.newTags),
      notes: itemForm.notes.trim() || null,
      projectId: project.value.id,
      quantity: Number(itemForm.quantity),
      storageLocation: itemForm.storageLocation.trim() || null,
      suggestedItemId: matchedSuggestion.value?.id ?? null,
      unit: itemForm.unit.trim() || matchedSuggestion.value?.defaultUnit || 'units',
      vendor: itemForm.vendor.trim() || null,
    })

    resetItemForm()
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
  lowStockThreshold: 0,
  name: '',
  newTags: '',
  notes: '',
  quantity: 0,
  storageLocation: '',
  unit: '',
  vendor: '',
})

const editSelectedTagIds = ref<string[]>([])

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
    return
  }

  editForm.itemId = item.id
  editForm.cost = item.cost ? item.cost.replace(/[^0-9.-]/g, '') : ''
  editForm.lowStockThreshold = item.threshold
  editForm.name = item.name
  editForm.newTags = ''
  editForm.notes = item.notes ?? ''
  editForm.quantity = item.quantity
  editForm.storageLocation = item.location ?? ''
  editForm.unit = item.unit
  editForm.vendor = item.vendor ?? ''
  editSelectedTagIds.value = item.tags
    .map(tagName => availableTagIdByName.value.get(tagName.toLowerCase()))
    .filter((tagId): tagId is string => Boolean(tagId))
}

watch(
  [items, availableTags],
  ([currentItems]) => {
    if (currentItems.length === 0) {
      editForm.itemId = ''
      editSelectedTagIds.value = []
      return
    }

    const matchedItem = currentItems.find(item => item.id === editForm.itemId)
    populateEditForm(matchedItem?.id ?? currentItems[0].id)
  },
  { immediate: true },
)

const isEditTagSelected = (tagId: string) => editSelectedTagIds.value.includes(tagId)

const toggleEditTag = (tagId: string) => {
  if (isEditTagSelected(tagId)) {
    editSelectedTagIds.value = editSelectedTagIds.value.filter(selectedId => selectedId !== tagId)
    return
  }

  editSelectedTagIds.value = [...editSelectedTagIds.value, tagId]
}

const isSavingItemEdit = ref(false)
const editItemError = ref<string | null>(null)
const isDeletingItem = ref(false)
const selectedPhotoFile = ref<File | null>(null)
const photoInputKey = ref(0)
const photoError = ref<string | null>(null)
const isUploadingPhoto = ref(false)
const isDeletingPhoto = ref(false)

const handleUpdateItem = async () => {
  editItemError.value = null
  isSavingItemEdit.value = true

  try {
    await updateProjectItem({
      cost: editForm.cost.trim() ? Number(editForm.cost) : null,
      existingTagIds: editSelectedTagIds.value,
      itemId: editForm.itemId,
      lowStockThreshold: Number(editForm.lowStockThreshold),
      name: editForm.name,
      newTagNames: parseTagNames(editForm.newTags),
      notes: editForm.notes.trim() || null,
      quantity: Number(editForm.quantity),
      storageLocation: editForm.storageLocation.trim() || null,
      suggestedItemId: matchedEditSuggestion.value?.id ?? selectedEditItem.value?.suggestedItemId ?? null,
      unit: editForm.unit.trim() || matchedEditSuggestion.value?.defaultUnit || 'units',
      vendor: editForm.vendor.trim() || null,
    })

    await refresh()
  }
  catch (submissionError) {
    editItemError.value = submissionError instanceof Error ? submissionError.message : 'Unable to save the item.'
  }
  finally {
    isSavingItemEdit.value = false
  }
}

const handleDeleteItem = async () => {
  if (!editForm.itemId) {
    editItemError.value = 'Select an item to delete.'
    return
  }

  if (process.client && !window.confirm('Delete this item from the project? This also removes its tag links and adjustment history.')) {
    return
  }

  editItemError.value = null
  isDeletingItem.value = true

  try {
    const deletedItemId = editForm.itemId
    await deleteProjectItem(deletedItemId)
    await refresh()

    if (items.value.length > 0) {
      const fallbackItem = items.value.find(item => item.id !== deletedItemId) ?? items.value[0]
      populateEditForm(fallbackItem.id)
    }
  }
  catch (submissionError) {
    editItemError.value = submissionError instanceof Error ? submissionError.message : 'Unable to delete the item.'
  }
  finally {
    isDeletingItem.value = false
  }
}

const handlePhotoSelection = (event: Event) => {
  const target = event.target as HTMLInputElement
  selectedPhotoFile.value = target.files?.[0] ?? null
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

const adjustmentForm = reactive({
  delta: 1,
  itemId: '',
  note: '',
  reason: 'correction' as const,
})

const isAdjustingItem = ref(false)
const adjustmentError = ref<string | null>(null)

watch(
  items,
  value => {
    if (!adjustmentForm.itemId && value.length > 0) {
      adjustmentForm.itemId = value[0].id
    }

    if (adjustmentForm.itemId && !value.some(item => item.id === adjustmentForm.itemId)) {
      adjustmentForm.itemId = value[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const handleAdjustQuantity = async () => {
  adjustmentError.value = null
  isAdjustingItem.value = true

  try {
    await adjustProjectItemQuantity({
      delta: Number(adjustmentForm.delta),
      itemId: adjustmentForm.itemId,
      note: adjustmentForm.note.trim() || null,
      reason: adjustmentForm.reason,
    })

    adjustmentForm.delta = 1
    adjustmentForm.note = ''

    await refresh()
  }
  catch (submissionError) {
    adjustmentError.value = submissionError instanceof Error ? submissionError.message : 'Unable to adjust the quantity.'
  }
  finally {
    isAdjustingItem.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <section v-if="pending" class="surface-card">
      <cindor-spinner />
    </section>

    <template v-else>
      <section class="surface-card">
        <div class="row-between">
          <div>
            <div class="eyebrow">{{ project.typeLabel }}</div>
            <h1 class="hero-title">{{ project.name }}</h1>
          </div>
          <cindor-badge :tone="project.lowStockCount > 0 ? 'accent' : 'success'">
            {{ project.lowStockCount }} low stock
          </cindor-badge>
        </div>

        <p class="muted">
          {{ project.summary }}
        </p>

        <div v-if="project.tags.length > 0" class="tag-list">
          <cindor-chip
            v-for="tag in project.tags"
            :key="tag"
            tone="neutral"
          >
            {{ tag }}
          </cindor-chip>
        </div>

        <div class="inline-meta">
          <span class="user-pill">{{ project.memberCount }} collaborators</span>
          <span class="user-pill">{{ project.itemCount }} items</span>
          <span class="user-pill">{{ project.lastUpdated }}</span>
          <span v-if="project.membershipRole" class="user-pill">Role: {{ project.membershipRole }}</span>
        </div>

        <cindor-alert :tone="projectData.source === 'live' ? 'success' : 'info'">
          {{
            projectData.notice
              ?? 'This project is loading from Supabase and respects the owner/editor/viewer membership rules.'
          }}
        </cindor-alert>
      </section>

      <section class="detail-grid">
        <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Project inventory</h2>
              <span class="muted">Photos, quantity, storage, vendor, cost, notes, tags, and threshold</span>
            </div>

          <table v-if="items.length > 0" class="item-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Threshold</th>
                <th>Location</th>
                <th>Vendor</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items"
                :key="item.id"
                :class="{ 'item-table__danger': item.isLowStock }"
              >
                <td>
                  <strong>{{ item.name }}</strong>
                  <div v-if="item.photo" class="item-photo-summary">
                    <img
                      :src="item.photo.url"
                      :alt="`${item.name} photo`"
                      class="item-photo-summary__image"
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
                </td>
                <td>{{ item.quantity }} {{ item.unit }}</td>
                <td>{{ item.threshold }} {{ item.unit }}</td>
                <td>{{ item.location ?? 'No location set' }}</td>
                <td>{{ item.vendor ?? 'Not set' }}</td>
                <td>{{ item.cost ?? 'Not set' }}</td>
              </tr>
            </tbody>
          </table>

          <div v-else class="empty-state">
            This project has no items yet. Add the first one from the forms on the right.
          </div>
        </div>

        <div class="page-stack">
          <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Add an item</h2>
              <span class="muted">Autocomplete uses the built-in project-type suggestions</span>
            </div>

            <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
              Add your Supabase environment variables before creating live project items.
            </cindor-alert>

            <cindor-alert v-else-if="!projectData.canEditProject" tone="warning">
              You are a viewer on this project, so inventory edits are disabled.
            </cindor-alert>

            <cindor-alert v-if="createItemError" tone="danger">
              {{ createItemError }}
            </cindor-alert>

            <form class="form-grid" @submit.prevent="handleCreateItem">
              <div class="field">
                <label for="item-name">Item name</label>
                <input
                  id="item-name"
                  v-model="itemForm.name"
                  class="text-input"
                  list="suggested-items"
                  maxlength="120"
                  placeholder="Start typing a suggested item or enter a new one"
                  required
                >
                <datalist id="suggested-items">
                  <option
                    v-for="suggestionName in itemSuggestionNames"
                    :key="suggestionName"
                    :value="suggestionName"
                  />
                </datalist>
              </div>

              <div class="field-grid">
                <div class="field">
                  <label for="item-quantity">Quantity</label>
                  <input
                    id="item-quantity"
                    v-model.number="itemForm.quantity"
                    class="text-input"
                    min="0"
                    step="0.01"
                    type="number"
                  >
                </div>

                <div class="field">
                  <label for="item-unit">Unit</label>
                  <input
                    id="item-unit"
                    v-model="itemForm.unit"
                    class="text-input"
                    maxlength="20"
                    placeholder="skeins, packs, yards..."
                  >
                </div>

                <div class="field">
                  <label for="item-threshold">Low-stock threshold</label>
                  <input
                    id="item-threshold"
                    v-model.number="itemForm.lowStockThreshold"
                    class="text-input"
                    min="0"
                    step="0.01"
                    type="number"
                  >
                </div>

                <div class="field">
                  <label for="item-cost">Cost</label>
                  <input
                    id="item-cost"
                    v-model="itemForm.cost"
                    class="text-input"
                    min="0"
                    step="0.01"
                    type="number"
                  >
                </div>

                <div class="field">
                  <label for="item-location">Storage location</label>
                  <input
                    id="item-location"
                    v-model="itemForm.storageLocation"
                    class="text-input"
                    maxlength="120"
                    placeholder="Shelf, drawer, bin..."
                  >
                </div>

                <div class="field">
                  <label for="item-vendor">Vendor/source</label>
                  <input
                    id="item-vendor"
                    v-model="itemForm.vendor"
                    class="text-input"
                    maxlength="120"
                    placeholder="Where you bought it"
                  >
                </div>
              </div>

              <div class="field">
                <label>Existing tags</label>
                <div v-if="availableTags.length > 0" class="tag-toggle-list">
                  <button
                    v-for="tag in availableTags"
                    :key="tag.id"
                    class="tag-toggle"
                    :class="{ 'tag-toggle--selected': isSelectedTag(tag.id) }"
                    type="button"
                    @click="toggleTag(tag.id)"
                  >
                    {{ tag.name }}
                  </button>
                </div>
                <div v-else class="helper-text">
                  No tags exist yet. Add new tags below and they will be saved for the project owner.
                </div>
              </div>

              <div class="field">
                <label for="item-new-tags">New tags</label>
                <input
                  id="item-new-tags"
                  v-model="itemForm.newTags"
                  class="text-input"
                  maxlength="200"
                  placeholder="Comma separated, for example yarn, gift, wool"
                >
              </div>

              <div class="field">
                <label for="item-notes">Notes</label>
                <textarea
                  id="item-notes"
                  v-model="itemForm.notes"
                  class="textarea-input"
                  maxlength="500"
                  placeholder="Optional notes, variants, or restock reminders"
                />
              </div>

              <div class="button-row">
                <cindor-button
                  :disabled="!isSupabaseConfigured || !projectData.canEditProject || isCreatingItem || !itemForm.name.trim()"
                  type="submit"
                >
                  {{ isCreatingItem ? 'Adding item...' : 'Add item' }}
                </cindor-button>
              </div>
            </form>
          </div>

          <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Edit or delete an item</h2>
              <span class="muted">Update item details, tags, and photos without leaving the project</span>
            </div>

            <cindor-alert v-if="editItemError" tone="danger">
              {{ editItemError }}
            </cindor-alert>

            <cindor-alert v-if="photoError" tone="danger">
              {{ photoError }}
            </cindor-alert>

            <form class="form-grid" @submit.prevent="handleUpdateItem">
              <div class="field">
                <label for="edit-item">Item</label>
                <select
                  id="edit-item"
                  v-model="editForm.itemId"
                  class="select-input"
                  @change="populateEditForm(editForm.itemId)"
                >
                  <option
                    v-for="item in items"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div v-if="selectedEditItem" class="form-grid">
                <div class="field">
                  <label for="edit-item-name">Item name</label>
                  <input
                    id="edit-item-name"
                    v-model="editForm.name"
                    class="text-input"
                    list="suggested-items"
                    maxlength="120"
                    required
                  >
                </div>

                <div class="field-grid">
                  <div class="field">
                    <label for="edit-item-quantity">Quantity</label>
                    <input
                      id="edit-item-quantity"
                      v-model.number="editForm.quantity"
                      class="text-input"
                      min="0"
                      step="0.01"
                      type="number"
                    >
                  </div>

                  <div class="field">
                    <label for="edit-item-unit">Unit</label>
                    <input
                      id="edit-item-unit"
                      v-model="editForm.unit"
                      class="text-input"
                      maxlength="20"
                    >
                  </div>

                  <div class="field">
                    <label for="edit-item-threshold">Low-stock threshold</label>
                    <input
                      id="edit-item-threshold"
                      v-model.number="editForm.lowStockThreshold"
                      class="text-input"
                      min="0"
                      step="0.01"
                      type="number"
                    >
                  </div>

                  <div class="field">
                    <label for="edit-item-cost">Cost</label>
                    <input
                      id="edit-item-cost"
                      v-model="editForm.cost"
                      class="text-input"
                      min="0"
                      step="0.01"
                      type="number"
                    >
                  </div>

                  <div class="field">
                    <label for="edit-item-location">Storage location</label>
                    <input
                      id="edit-item-location"
                      v-model="editForm.storageLocation"
                      class="text-input"
                      maxlength="120"
                    >
                  </div>

                  <div class="field">
                    <label for="edit-item-vendor">Vendor/source</label>
                    <input
                      id="edit-item-vendor"
                      v-model="editForm.vendor"
                      class="text-input"
                      maxlength="120"
                    >
                  </div>
                </div>

                <div class="field">
                  <label>Existing tags</label>
                  <div v-if="availableTags.length > 0" class="tag-toggle-list">
                    <button
                      v-for="tag in availableTags"
                      :key="tag.id"
                      class="tag-toggle"
                      :class="{ 'tag-toggle--selected': isEditTagSelected(tag.id) }"
                      type="button"
                      @click="toggleEditTag(tag.id)"
                    >
                      {{ tag.name }}
                    </button>
                  </div>
                </div>

                <div class="field">
                  <label for="edit-item-new-tags">New tags</label>
                  <input
                    id="edit-item-new-tags"
                    v-model="editForm.newTags"
                    class="text-input"
                    maxlength="200"
                    placeholder="Comma separated tag names"
                  >
                </div>

                <div class="field">
                  <label for="edit-item-notes">Notes</label>
                  <textarea
                    id="edit-item-notes"
                    v-model="editForm.notes"
                    class="textarea-input"
                    maxlength="500"
                  />
                </div>

                <div class="field">
                  <label for="edit-item-photo">Photo</label>
                  <div v-if="selectedEditItem.photo" class="item-photo-panel">
                    <img
                      :src="selectedEditItem.photo.url"
                      :alt="`${selectedEditItem.name} photo`"
                      class="item-photo-panel__image"
                    >
                    <div class="helper-text">
                      {{ selectedEditItem.photo.mimeType ?? 'Image' }}
                      <span v-if="formatPhotoFileSize(selectedEditItem.photo.fileSizeBytes)">
                        · {{ formatPhotoFileSize(selectedEditItem.photo.fileSizeBytes) }}
                      </span>
                    </div>
                  </div>
                  <div v-else class="helper-text">
                    No photo has been uploaded for this item yet.
                  </div>
                  <input
                    :key="photoInputKey"
                    id="edit-item-photo"
                    accept="image/jpeg,image/png,image/webp"
                    class="text-input"
                    type="file"
                    @change="handlePhotoSelection"
                  >
                  <div class="button-row">
                    <cindor-button
                      :disabled="!isSupabaseConfigured || !projectData.canEditProject || isUploadingPhoto || !selectedEditItem || !selectedPhotoFile"
                      type="button"
                      @click="handleUploadPhoto"
                    >
                      {{ isUploadingPhoto ? 'Uploading photo...' : (selectedEditItem.photo ? 'Replace photo' : 'Upload photo') }}
                    </cindor-button>
                    <cindor-button
                      :disabled="!isSupabaseConfigured || !projectData.canEditProject || isDeletingPhoto || !selectedEditItem?.photo"
                      type="button"
                      variant="ghost"
                      @click="handleDeletePhoto"
                    >
                      {{ isDeletingPhoto ? 'Deleting photo...' : 'Delete photo' }}
                    </cindor-button>
                  </div>
                </div>

                <div class="button-row">
                  <cindor-button
                    :disabled="!isSupabaseConfigured || !projectData.canEditProject || isSavingItemEdit || !editForm.itemId || !editForm.name.trim()"
                    type="submit"
                  >
                    {{ isSavingItemEdit ? 'Saving item...' : 'Save item changes' }}
                  </cindor-button>
                  <cindor-button
                    :disabled="!isSupabaseConfigured || !projectData.canEditProject || isDeletingItem || !editForm.itemId"
                    type="button"
                    variant="ghost"
                    @click="handleDeleteItem"
                  >
                    {{ isDeletingItem ? 'Deleting item...' : 'Delete item' }}
                  </cindor-button>
                </div>
              </div>

              <div v-else class="empty-state">
                No items are available to edit yet.
              </div>
            </form>
          </div>

          <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Adjust quantity</h2>
              <span class="muted">Creates a quantity-history record each time</span>
            </div>

            <cindor-alert v-if="adjustmentError" tone="danger">
              {{ adjustmentError }}
            </cindor-alert>

            <form class="form-grid" @submit.prevent="handleAdjustQuantity">
              <div class="field">
                <label for="adjust-item">Item</label>
                <select
                  id="adjust-item"
                  v-model="adjustmentForm.itemId"
                  class="select-input"
                >
                  <option
                    v-for="item in items"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div class="field-grid">
                <div class="field">
                  <label for="adjust-delta">Delta</label>
                  <input
                    id="adjust-delta"
                    v-model.number="adjustmentForm.delta"
                    class="text-input"
                    step="0.01"
                    type="number"
                  >
                </div>

                <div class="field">
                  <label for="adjust-reason">Reason</label>
                  <select
                    id="adjust-reason"
                    v-model="adjustmentForm.reason"
                    class="select-input"
                  >
                    <option value="restock">Restock</option>
                    <option value="usage">Usage</option>
                    <option value="correction">Correction</option>
                    <option value="inventory_count">Inventory count</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label for="adjust-note">Note</label>
                <textarea
                  id="adjust-note"
                  v-model="adjustmentForm.note"
                  class="textarea-input"
                  maxlength="300"
                  placeholder="Optional note explaining the change"
                />
              </div>

              <div class="button-row">
                <cindor-button
                  :disabled="!isSupabaseConfigured || !projectData.canEditProject || isAdjustingItem || !adjustmentForm.itemId || adjustmentForm.delta === 0"
                  type="submit"
                >
                  {{ isAdjustingItem ? 'Saving adjustment...' : 'Save adjustment' }}
                </cindor-button>
              </div>
            </form>
          </div>

          <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Recent adjustments</h2>
              <span class="muted">Most recent quantity changes for this project</span>
            </div>

            <div v-if="recentAdjustments.length > 0" class="adjustment-list">
              <div
                v-for="adjustment in recentAdjustments"
                :key="adjustment.id"
                class="adjustment-item"
              >
                <div class="row-between">
                  <strong>{{ adjustment.itemName }}</strong>
                  <span
                    class="adjustment-item__delta"
                    :class="adjustment.delta > 0 ? 'adjustment-item__delta--positive' : 'adjustment-item__delta--negative'"
                  >
                    {{ adjustment.delta > 0 ? '+' : '' }}{{ adjustment.delta }}
                  </span>
                </div>
                <div class="muted">
                  {{ adjustment.reason }} · new quantity {{ adjustment.newQuantity }} · {{ adjustment.createdAtLabel }}
                </div>
                <div v-if="adjustment.note" class="muted">
                  {{ adjustment.note }}
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              No quantity changes have been recorded for this project yet.
            </div>
          </div>

          <div class="surface-card">
            <div class="section-header">
              <h2 class="section-title">Suggested items</h2>
              <span class="muted">Built-in list for {{ project.typeLabel }}</span>
            </div>

            <div v-if="suggestions.length > 0" class="suggestion-list">
              <div
                v-for="suggestion in suggestions"
                :key="suggestion.id"
                class="surface-card surface-card--tight"
              >
                <div class="row-between">
                  <strong>{{ suggestion.name }}</strong>
                  <cindor-badge tone="neutral">{{ suggestion.defaultUnit }}</cindor-badge>
                </div>
              </div>
            </div>

            <div v-else class="empty-state">
              No built-in suggestions are available for this project type yet.
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
