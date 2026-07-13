const multer = require('multer');

// Configure memory storage to receive uploads as buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB limits
  }
});

module.exports = {
  uploadSingle: upload.single('file')
};
