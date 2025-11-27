/**
 * Config plugin to ensure expo-background-task iOS settings are applied correctly.
 *
 * The expo-background-task and expo-background-fetch plugins can conflict,
 * with background-fetch potentially overwriting UIBackgroundModes.
 * This plugin runs last to ensure all required background modes are present.
 */
const { withInfoPlist } = require('expo/config-plugins');

const withBackgroundTaskConfig = (config) => {
  return withInfoPlist(config, (modConfig) => {
    const infoPlist = modConfig.modResults;

    // Ensure UIBackgroundModes contains both 'fetch' and 'processing'
    const requiredModes = ['fetch', 'processing'];
    const currentModes = infoPlist.UIBackgroundModes || [];
    const mergedModes = [...new Set([...currentModes, ...requiredModes])];
    infoPlist.UIBackgroundModes = mergedModes;

    // Ensure BGTaskSchedulerPermittedIdentifiers is set
    const requiredIdentifiers = ['com.expo.modules.backgroundtask.processing'];
    const currentIdentifiers =
      infoPlist.BGTaskSchedulerPermittedIdentifiers || [];
    const mergedIdentifiers = [
      ...new Set([...currentIdentifiers, ...requiredIdentifiers]),
    ];
    infoPlist.BGTaskSchedulerPermittedIdentifiers = mergedIdentifiers;

    console.log(
      '[with-background-task-config] Applied UIBackgroundModes:',
      mergedModes
    );
    console.log(
      '[with-background-task-config] Applied BGTaskSchedulerPermittedIdentifiers:',
      mergedIdentifiers
    );

    return modConfig;
  });
};

module.exports = withBackgroundTaskConfig;
