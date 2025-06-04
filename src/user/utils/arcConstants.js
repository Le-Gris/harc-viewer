// ARC Experiment Constants
export const EXPERIMENT_CONFIG = {
  MAX_TASKS_PER_EXPERIMENT: 5,
  MAX_ATTEMPTS_PER_TASK: 3,
  UNDO_STACK_LIMIT: 20,
}

export const GRID_CONFIG = {
  DEFAULT_HEIGHT: 3,
  DEFAULT_WIDTH: 3,
  MAX_SIZE: 30,
  EDITION_CONTAINER_HEIGHT: 400,
  EDITION_CONTAINER_WIDTH: 400,
  MAX_CELL_SIZE: 100,
}

export const TOOLS = {
  EDIT: 'edit',
  SELECT: 'select',
  FLOODFILL: 'floodfill',
}

export const EXPERIMENT_PHASES = {
  LOADING: 'loading',
  TUTORIAL_SLIDES: 'tutorial_slides',
  TUTORIAL_TASK: 'tutorial_task',
  TUTORIAL_QUIZ: 'tutorial_quiz',
  EXPERIMENT: 'experiment',
  FINISHED: 'finished',
}

export const DEFAULT_SYMBOL = 0
