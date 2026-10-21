/** One-time owner-only reduction of the *existing* Annals Gmail scan cadence.
 * No second service, new project, credential, cursor reset or standing gate.
 * Apps Script's existing lock already serialises overlapping intake attempts.
 * The original 15-minute trigger remains untouched until this function runs.
 */
function annalsSetFiveMinuteIntakeInEditor() {
  annalsOwner_();
  return annalsLocked_(function () {
    var p=annalsProps_();
    if (p.getProperty('ANNALS_PRODUCTION_INTAKE_ENABLED')!=='true')
      throw Error('Intake is not enabled in the original owner project');
    var triggers=ScriptApp.getProjectTriggers();
    if (triggers.length!==1 ||
        triggers[0].getHandlerFunction()!=='runAnnalsProductionIntake')
      throw Error('Expected one existing intake trigger; no schedule changed');
    // Only the successfully installed cadence writes this persistent marker.
    if (p.getProperty('ANNALS_INTAKE_CADENCE_MINUTES')==='5')
      return {configured:true,intervalMinutes:5,triggerCount:1,alreadyConfigured:true};
    var replacement=null;
    try {
      replacement=ScriptApp.newTrigger('runAnnalsProductionIntake').timeBased().everyMinutes(5).create();
      ScriptApp.deleteTrigger(triggers[0]);
    } catch (ignored) {
      // On delete failure, remove the newly created trigger and keep the old.
      if (replacement) try { ScriptApp.deleteTrigger(replacement); } catch (ignoredAgain) {}
      throw Error('Five-minute intake replacement failed; inspect owner trigger list');
    }
    var current=ScriptApp.getProjectTriggers();
    if (current.length!==1 ||
        current[0].getHandlerFunction()!=='runAnnalsProductionIntake')
      throw Error('Intake trigger count requires owner inspection; do not retry blindly');
    p.setProperty('ANNALS_INTAKE_CADENCE_MINUTES','5');
    return {configured:true,intervalMinutes:5,triggerCount:1,alreadyConfigured:false};
  });
}
