const prisma = require('../../config/db');

// --- Bucket Repository Actions ---

const createBucket = async ({ projectId, name, isPublic }) => {
  return await prisma.storageBucket.create({
    data: {
      projectId,
      name,
      isPublic
    }
  });
};

const getBucketByName = async (projectId, name) => {
  return await prisma.storageBucket.findUnique({
    where: {
      projectId_name: {
        projectId,
        name
      }
    }
  });
};

const listBuckets = async (projectId) => {
  return await prisma.storageBucket.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' }
  });
};

const deleteBucket = async (id) => {
  return await prisma.storageBucket.delete({
    where: { id }
  });
};

const updateBucketVisibility = async (id, isPublic) => {
  return await prisma.storageBucket.update({
    where: { id },
    data: { isPublic }
  });
};

// --- File Repository Actions ---

const createFile = async (fileData) => {
  return await prisma.storageFile.create({
    data: fileData
  });
};

const getFileByPath = async (bucketId, path) => {
  return await prisma.storageFile.findUnique({
    where: {
      bucketId_path: {
        bucketId,
        path
      }
    }
  });
};

const deleteFile = async (id) => {
  return await prisma.storageFile.delete({
    where: { id }
  });
};

const updateFilePath = async (id, newPath) => {
  return await prisma.storageFile.update({
    where: { id },
    data: {
      path: newPath
    }
  });
};

const listFiles = async ({ bucketId, folderPrefix, search, sort = 'createdAt', order = 'desc', limit = 20, offset = 0 }) => {
  const whereClause = {
    bucketId
  };

  // Filter by folder path prefix if provided
  if (folderPrefix) {
    whereClause.path = {
      startsWith: folderPrefix
    };
  }

  // Handle textual search
  if (search) {
    whereClause.OR = [
      { originalName: { contains: search } },
      { path: { contains: search } }
    ];
  }

  const items = await prisma.storageFile.findMany({
    where: whereClause,
    orderBy: {
      [sort]: order.toLowerCase() === 'asc' ? 'asc' : 'desc'
    },
    take: limit,
    skip: offset
  });

  const total = await prisma.storageFile.count({
    where: whereClause
  });

  return {
    items,
    total
  };
};

module.exports = {
  createBucket,
  getBucketByName,
  listBuckets,
  deleteBucket,
  updateBucketVisibility,
  createFile,
  getFileByPath,
  deleteFile,
  updateFilePath,
  listFiles
};
