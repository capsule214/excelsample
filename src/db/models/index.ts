export { ModelMaster }      from "./model-master"
export { Device }           from "./device"
export { Assignee }         from "./assignee"
export { Task }             from "./task"
export { Location }         from "./location"
export { Schedule }         from "./schedule"
export { LocationSchedule } from "./location-schedule"
export { DisplaySetting }   from "./display-setting"

import { ModelMaster }      from "./model-master"
import { Device }           from "./device"
import { Assignee }         from "./assignee"
import { Task }             from "./task"
import { Location }         from "./location"
import { Schedule }         from "./schedule"
import { LocationSchedule } from "./location-schedule"

// ─── Associations ─────────────────────────────────────────────────────────────

Device.belongsTo(ModelMaster, { foreignKey: "model_id",    as: "model" })
Schedule.belongsTo(Task,      { foreignKey: "task_id",     as: "task" })
Schedule.belongsTo(Assignee,  { foreignKey: "assignee_id", as: "assignee" })
Schedule.belongsTo(Device,    { foreignKey: "device_id",   as: "device" })
Schedule.belongsTo(Location,  { foreignKey: "location_id", as: "location" })
LocationSchedule.belongsTo(Location, { foreignKey: "location_id", as: "location" })
LocationSchedule.belongsTo(Device,   { foreignKey: "device_id",   as: "device" })
