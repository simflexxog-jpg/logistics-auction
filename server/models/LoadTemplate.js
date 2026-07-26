const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoadTemplate = sequelize.define('LoadTemplate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  templateData: { type: DataTypes.JSON }, // Mirrors POST /api/customer/post-load body
  orgId: { type: DataTypes.UUID }
}, { 
  timestamps: true,
  indexes: [
    { fields: ['userId', 'orgId'] } // User's templates only
  ]
});

module.exports = LoadTemplate;
