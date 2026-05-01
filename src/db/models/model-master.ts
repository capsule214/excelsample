import { DataTypes } from "sequelize"
import { sequelize } from "../connection"

export const ModelMaster = sequelize.define("ModelMaster", {
  model_id:   { type: DataTypes.TEXT, primaryKey: true },
  model_name: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "models", timestamps: false })
