<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const user = useSupabaseUser()
const { createProject, isSupabaseConfigured, loadDashboardData } = useInventoryData()

const userEmail = computed(() => {
  if (!user.value || typeof user.value.email !== 'string') {
    return 'maker'
  }

  return user.value.email
})

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

const isCreatingProject = ref(false)
const createProjectError = ref<string | null>(null)

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
  isCreatingProject.value = true

  try {
    const project = await createProject({
      name: projectForm.name,
      projectTypeId: projectForm.projectTypeId || null,
      description: projectForm.description.trim() || null,
    })

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
    <section class="hero-grid">
      <div class="surface-card">
        <div class="eyebrow">Dashboard</div>
        <h1 class="hero-title">Welcome back, {{ userEmail }}</h1>
        <p class="muted">
          Track project-level inventory, catch low-stock items early, and keep suggested supplies
          organized by project type.
        </p>

        <div class="button-row">
          <NuxtLink v-if="projects.length > 0" :to="`/projects/${projects[0].id}`">
            <cindor-button>Open your latest project</cindor-button>
          </NuxtLink>
          <NuxtLink to="/login">
            <cindor-button variant="ghost">Review auth entry point</cindor-button>
          </NuxtLink>
        </div>
      </div>

      <div class="surface-card">
        <div class="section-header">
          <h2 class="section-title">Data source</h2>
          <cindor-badge :tone="dashboard.source === 'live' ? 'success' : 'accent'">
            {{ dashboard.source === 'live' ? 'Live Supabase data' : 'Preview fallback' }}
          </cindor-badge>
        </div>

        <cindor-alert v-if="error" tone="danger">
          {{ error.message }}
        </cindor-alert>

        <cindor-alert :tone="dashboard.source === 'live' ? 'success' : 'info'">
          {{
            dashboard.notice
              ?? 'The dashboard is reading from the Supabase schema and current authenticated project memberships.'
          }}
        </cindor-alert>
      </div>
    </section>

    <section class="stats-grid">
      <div class="surface-card surface-card--tight">
        <div class="metric">
          <span class="metric__value">{{ projects.length }}</span>
          <span class="metric__label">Active projects</span>
        </div>
      </div>

      <div class="surface-card surface-card--tight">
        <div class="metric">
          <span class="metric__value">{{ lowStockItems.length }}</span>
          <span class="metric__label">Low-stock items</span>
        </div>
      </div>

      <div class="surface-card surface-card--tight">
        <div class="metric">
          <span class="metric__value">{{ projectTypes.length }}</span>
          <span class="metric__label">Built-in project types</span>
        </div>
      </div>
    </section>

    <section class="page-stack">
      <div class="section-header">
        <h2 class="section-title">Projects</h2>
        <span class="muted">Private by default, shareable with owner/editor/viewer roles</span>
      </div>

      <div v-if="pending" class="surface-card">
        <cindor-spinner />
      </div>

      <div v-else-if="projects.length > 0" class="project-grid">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
        />
      </div>

      <div v-else class="surface-card">
        <div class="empty-state">
          No projects yet. Create the first one to start tracking inventory.
        </div>
      </div>
    </section>

    <section class="detail-grid">
      <div class="surface-card">
        <div class="section-header">
          <h2 class="section-title">Low-stock items</h2>
          <span class="muted">Dashboard summary across projects</span>
        </div>

        <LowStockList v-if="lowStockItems.length > 0" :items="lowStockItems" />

        <div v-else class="empty-state">
          No low-stock items yet. Threshold tracking will surface them here automatically.
        </div>
      </div>

      <div class="surface-card">
        <div class="section-header">
          <h2 class="section-title">Create a project</h2>
          <span class="muted">Seeded project types drive built-in item suggestions</span>
        </div>

        <cindor-alert v-if="!isSupabaseConfigured" tone="warning">
          Add your Supabase environment variables before creating live projects.
        </cindor-alert>

        <cindor-alert v-if="createProjectError" tone="danger">
          {{ createProjectError }}
        </cindor-alert>

        <cindor-alert
          v-if="isSupabaseConfigured && dashboard.source === 'live' && !hasSeededProjectTypes"
          tone="warning"
        >
          No built-in project types were found in Supabase yet. You can still create a project as
          <strong>Crafting</strong>, then run the seed script later to unlock the full built-in list.
        </cindor-alert>

        <form class="form-grid" @submit.prevent="handleCreateProject">
          <div class="field">
            <label for="project-name">Project name</label>
            <input
              id="project-name"
              v-model="projectForm.name"
              class="text-input"
              maxlength="120"
              required
            >
          </div>

          <div class="field">
            <label for="project-type">Project type</label>
            <select
              id="project-type"
              v-model="projectForm.projectTypeId"
              class="select-input"
            >
              <option
                v-for="projectType in projectTypeOptions"
                :key="projectType.id"
                :value="projectType.id"
              >
                {{ projectType.label }}
              </option>
            </select>
            <div v-if="hasSeededProjectTypes" class="helper-text">
              {{ projectTypeOptions.find(option => option.id === projectForm.projectTypeId)?.description }}
            </div>
            <div v-else class="helper-text">
              The full built-in type list appears after `supabase/seed.sql` has been applied.
            </div>
          </div>

          <div class="field">
            <label for="project-description">Description</label>
            <textarea
              id="project-description"
              v-model="projectForm.description"
              class="textarea-input"
              maxlength="500"
              placeholder="What are you organizing in this project?"
            />
          </div>

          <div class="button-row">
            <cindor-button
              :disabled="!isSupabaseConfigured || isCreatingProject || !projectForm.name.trim()"
              type="submit"
            >
              {{ isCreatingProject ? 'Creating project...' : 'Create project' }}
            </cindor-button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
