import { loadDashboardDataForUser } from '~~/server/utils/inventory'

export default defineEventHandler(async event => await loadDashboardDataForUser(event))
