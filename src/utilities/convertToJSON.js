const xlsx = require("xlsx");

const convertToJSON = (filePath) => {
  const workbook = xlsx.readFile(filePath);

  return []
};

module.exports = { convertToJSON };
