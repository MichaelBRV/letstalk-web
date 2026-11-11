// Estado compartido de la sesión.
export const state = {
  user: null,
  niveles: [],
  config: {},
};

export const ROL_LABEL = {
  coordinacion: 'Coordinación académica',
  administrativo: 'Administrativo',
  profesor: 'Profesor',
};

export const isCoord = () => state.user?.rol === 'coordinacion';
export const isStaff = () => ['coordinacion', 'administrativo'].includes(state.user?.rol);
export const isProfesor = () => state.user?.rol === 'profesor';

export const ASIS = {
  P: { label: 'Presente', short: 'P', cls: 'ok' },
  A: { label: 'Ausente', short: 'A', cls: 'bad' },
  T: { label: 'Atraso', short: 'T', cls: 'warn' },
  J: { label: 'Justificada', short: 'J', cls: 'info' },
};
