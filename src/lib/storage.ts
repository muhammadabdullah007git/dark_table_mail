export const saveSetting = (name: string, value: string) => {
  localStorage.setItem(name, value);
};

export const loadSetting = (name: string) => {
  return localStorage.getItem(name);
};

// Keys
export const GAS_URL_KEY = 'mailman_gas_url';
export const WHATSAPP_COUNTRY_CODE_KEY = 'mailman_whatsapp_country_code';
export const CURRENT_PLATFORM_KEY = 'mailman_current_platform';
export const THEME_KEY = 'mailman_theme';
export const UI_FONT_KEY = 'mailman_ui_font';
export const UI_FONT_SIZE_KEY = 'mailman_ui_font_size';
export const SIDE_PANEL_WIDTH_KEY = 'mailman_side_panel_width';
export const SOURCE_MODE_KEY = 'mailman_source_mode';
export const MAIL_COUNT_MODE_KEY = 'mailman_mail_count_mode';
export const VARIABLE_MAPPING_KEY = 'mailman_variable_mapping';
export const FIXED_MAIL_RANGE_KEY = 'mailman_fixed_mail_range';
export const CUSTOM_VARIABLE_VALUES_KEY = 'mailman_custom_variable_values';
