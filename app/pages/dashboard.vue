<script setup lang="ts">
import {
  CindorCard,
  CindorDialog,
  CindorEmptyState,
  CindorFormField,
  CindorInput,
  CindorOption,
  CindorPageHeader,
  CindorSelect,
  CindorStatCard,
  CindorTextarea,
} from 'cindor-ui-vue'

type ValidatableFieldElement = HTMLElement & {
  focus: (options?: FocusOptions) => void
  reportValidity?: () => boolean
}

definePageMeta({
  middleware: 'auth',
})

const { createProject, isSupabaseConfigured, loadDashboardData } = useInventoryData()
const { displayName } = useCurrentUserProfile()

const { data, error, pending, refresh } = await useAsyncData('dashboard-data', loadDashboardData, {
  default: () => ({
    source: 'live',
    notice: null,
    lowStockItems: [],
    projectTypes: [],
    projects: [],
  }),
})

const dashboard = computed(() => data.value!)
const projectTypes = computed(() => dashboard.value.projectTypes)
const projects = computed(() => dashboard.value.projects)
const lowStockItems = computed(() => dashboard.value.lowStockItems)
const hasSeededProjectTypes = computed(() => projectTypes.value.length > 0)
const shouldShowMissingProjectTypesWarning = computed(() =>
  !pending.value
  && !error.value
  && isSupabaseConfigured.value
  && dashboard.value.source === 'live'
  && !hasSeededProjectTypes.value,
)
const shouldShowMissingProjectTypesHelper = computed(() =>
  !pending.value
  && !error.value
  && !hasSeededProjectTypes.value,
)
const projectTypeOptions = computed(() =>
  hasSeededProjectTypes.value
    ? projectTypes.value
    : [
        {
          id: '',
          label: 'Crafting',
          description: 'Fallback catch-all type when built-in project types have not been seeded yet.',
        },
      ],
)

const projectForm = reactive({
  name: '',
  projectTypeId: '',
  description: '',
})
const selectedProjectTypeDescription = computed(() =>
  projectTypeOptions.value.find(option => option.id === projectForm.projectTypeId)?.description ?? null,
)

const isCreatingProject = ref(false)
const isCreateProjectDialogOpen = ref(false)
const createProjectError = ref<string | null>(null)
const projectFieldErrors = reactive({
  name: '',
})
const projectNameInput = ref<ValidatableFieldElement | null>(null)

const focusField = async (field: ValidatableFieldElement | null) => {
  await nextTick()
  field?.focus()
  field?.reportValidity?.()
}

const validateProjectForm = async () => {
  projectFieldErrors.name = ''

  if (!projectForm.name.trim()) {
    projectFieldErrors.name = 'Enter a project name.'
    await focusField(projectNameInput.value)
    return false
  }

  return true
}

watch(() => projectForm.name, () => {
  if (projectFieldErrors.name) {
    projectFieldErrors.name = ''
  }
})

watch(isCreateProjectDialogOpen, value => {
  if (!value) {
    createProjectError.value = null
    projectFieldErrors.name = ''
  }
})

watch(
  projectTypeOptions,
  value => {
    if (!projectForm.projectTypeId && value.length > 0) {
      projectForm.projectTypeId = value[0].id
    }
  },
  { immediate: true },
)

const handleCreateProject = async () => {
  createProjectError.value = null

  if (!await validateProjectForm()) {
    return
  }

  isCreatingProject.value = true

  try {
    const project = await createProject({
      name: projectForm.name.trim(),
      projectTypeId: projectForm.projectTypeId || null,
      description: projectForm.description.trim() || null,
    })

    isCreateProjectDialogOpen.value = false
    projectForm.name = ''
    projectForm.description = ''

    await refresh()
    await navigateTo(`/projects/${project.id}`)
  }
  catch (error) {
    createProjectError.value = error instanceof Error ? error.message : 'Unable to create project.'
  }
  finally {
    isCreatingProject.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <CindorPageHeader
      description="Track project-level inventory, catch low-stock items early, and keep suggested supplies organized by project type."
      eyebrow="Dashboard"
      :title="`Welcome back, ${displayName}`"
    >
      <NuxtLink v-if="projects.length > 0" slot="actions" :to="`/projects/${projects[0].id}`">
        <cindor-button>Open your latest project</cindor-button>
      </NuxtLink>
    </CindorPageHeader>

    <cindor-alert v-if="error" tone="danger">
      {{ error.message }}
    </cindor-alert>

    <cindor-alert v-else-if="dashboard.notice" tone="info">
      {{ dashboard.notice }}
    </cindor-alert>

    <section class="stats-grid">
      <CindorStatCard
        label="Active projects"
        tone="neutral"
        :value="String(projects.length)"
      />
      <CindorStatCard
        label="Low-stock items"
        :tone="lowStockItems.length > 0 ? 'negative' : 'positive'"
        :value="String(lowStockItems.length)"
      />
      <CindorStatCard
        label="Built-in project types"
        tone="neutral"
        :value="String(projectTypes.length)"
      />
    </section>

    <section class="page-stack">
      <CindorPageHeader
        description="Private by default, shareable with owner/editor/viewer roles."
        title="Projects"
      >
        <cindor-button
          slot="actions"
          :disabled="!isSupabaseConfigured"
          @click="isCreateProjectDialogOpen = true"
        >
          Create project
        </cindor-button>
      </CindorPageHeader>

      <CindorCard v-if="pending">
        <cindor-spinner />
      </CindorCard>

      <div v-else-if="projects.length > 0" class="project-grid">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
        />
      </div>

      <CindorEmptyState v-else>
        <div>
          <h3>No projects yet</h3>
          <p>Create the first one to start tracking inventory.</p>
        </div>
        <cindor-button
          slot="actions"
          :disabled="!isSupabaseConfigured"
          @click="isCreateProjectDialogOpen = true"
        >
          Create project
        </cindor-button>
      </CindorEmptyState>
    </section>

    <section class="page-stack">
      <CindorCard>
        <CindorPageHeader
          description="Dashboard summary across projects."
          title="Low-stock items"
        />

        <LowStockList v-if="lowStockItems.length > 0" :items="lowStockItems" />

        <CindorEmptyState v-else>
          <div>
            <h3>No low-stock items yet</h3>
            <p>Threshold tracking will surface them here automatically.</p>
          </div>
        </CindorEmptyState>
      </CindorCard>
    </section>

    <CindorDialog v-model:open="isCreateProjectDialogOpen" modal>
      <div class="project-dialog page-stack">
        <CindorPageHeader
          description="Seeded project types drive built-in item suggestions."
          title="Create a project"
        />

        <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
          Add your Supabase environment variables before creating live projects.
        </cindor-alert>

        <cindor-alert v-if="createProjectError" tone="danger">
          {{ createProjectError }}
        </cindor-alert>

        <cindor-alert v-if="shouldShowMissingProjectTypesWarning" tone="warning">
          No built-in project types were found in Supabase yet. You can still create a project as
          <strong>Crafting</strong>, then run the seed script later to unlock the full built-in list.
        </cindor-alert>

        <form class="form-grid" @submit.prevent="handleCreateProject">
          <CindorFormField :error="projectFieldErrors.name" label="Project name" required>
            <CindorInput
              ref="projectNameInput"
              v-model="projectForm.name"
              autocomplete="off"
              maxlength="120"
              name="project-name"
              required
            />
          </CindorFormField>

          <CindorFormField
            :description="hasSeededProjectTypes ? (selectedProjectTypeDescription ?? '') : (shouldShowMissingProjectTypesHelper ? 'The full built-in type list appears after `supabase/seed.sql` has been applied.' : '')"
            label="Project type"
          >
            <CindorSelect
              v-model="projectForm.projectTypeId"
              autocomplete="off"
              name="project-type"
            >
              <CindorOption
                v-for="projectType in projectTypeOptions"
                :key="projectType.id"
                :label="projectType.label"
                :value="projectType.id"
              >
                {{ projectType.label }}
              </CindorOption>
            </CindorSelect>
          </CindorFormField>

          <CindorFormField label="Description">
            <CindorTextarea
              v-model="projectForm.description"
              autocomplete="off"
              maxlength="500"
              name="project-description"
              placeholder="For example, spring market booth supplies…"
            />
          </CindorFormField>

          <div class="button-row">
            <cindor-button
              :disabled="!isSupabaseConfigured || isCreatingProject"
              type="submit"
            >
              {{ isCreatingProject ? 'Creating project…' : 'Create project' }}
            </cindor-button>
            <cindor-button
              type="button"
              variant="ghost"
              @click="isCreateProjectDialogOpen = false"
            >
              Cancel
            </cindor-button>
          </div>
        </form>
      </div>
    </CindorDialog>
  </div>
</template>
