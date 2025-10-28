// @ts-nocheck
import * as FileSystem from 'expo-file-system';

import { getModelPaths } from '../model-config';
import { deleteModel, downloadModel, updateModel } from '../model-lifecycle';
import { getModelManager, ModelManager } from '../model-manager';
import { loadModelMetadata, saveModelMetadata } from '../model-metadata';
import {
  getModelSize,
  validateModelChecksum,
  validateModelSize,
} from '../model-validation';

// Mock dependencies
jest.mock('expo-file-system');
jest.mock('../model-config');
jest.mock('../model-metadata');
jest.mock('../model-validation');
jest.mock('../model-lifecycle');

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockGetModelPaths = getModelPaths as jest.MockedFunction<
  typeof getModelPaths
>;
const mockLoadModelMetadata = loadModelMetadata as jest.MockedFunction<
  typeof loadModelMetadata
>;
const mockSaveModelMetadata = saveModelMetadata as jest.MockedFunction<
  typeof saveModelMetadata
>;
const mockValidateModelChecksum = validateModelChecksum as jest.MockedFunction<
  typeof validateModelChecksum
>;
const mockGetModelSize = getModelSize as jest.MockedFunction<
  typeof getModelSize
>;
const mockValidateModelSize = validateModelSize as jest.MockedFunction<
  typeof validateModelSize
>;
const mockDownloadModel = downloadModel as jest.MockedFunction<
  typeof downloadModel
>;
const mockUpdateModel = updateModel as jest.MockedFunction<typeof updateModel>;
const mockDeleteModel = deleteModel as jest.MockedFunction<typeof deleteModel>;

describe('ModelManager', () => {
  let modelManager: ModelManager;

  const mockModelPaths = {
    baseDir: 'file:///models/',
    modelPath: 'file:///models/model.tflite',
    metadataPath: 'file:///models/metadata.json',
    checksumsPath: 'file:///models/checksums.json',
  };

  const mockModelInfo = {
    version: '1.0.0',
    delegates: [],
    lastUpdated: '2023-01-01T00:00:00.000Z',
    description: 'Test model',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    modelManager = new ModelManager();

    mockGetModelPaths.mockResolvedValue(mockModelPaths);
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: '',
      size: 1000,
      isDirectory: false,
      modificationTime: 0,
    });
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize successfully and load metadata', async () => {
      mockLoadModelMetadata.mockResolvedValue(mockModelInfo);

      await modelManager.initialize();

      expect(mockGetModelPaths).toHaveBeenCalled();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        mockModelPaths.baseDir,
        { intermediates: true }
      );
      expect(mockLoadModelMetadata).toHaveBeenCalled();
      expect(modelManager.getModelInfo()).toEqual(mockModelInfo);
    });

    it('should not reinitialize if already initialized', async () => {
      mockLoadModelMetadata.mockResolvedValue(mockModelInfo);

      await modelManager.initialize();
      await modelManager.initialize();

      expect(mockLoadModelMetadata).toHaveBeenCalledTimes(1);
    });

    it('should throw error on initialization failure', async () => {
      mockFileSystem.makeDirectoryAsync.mockRejectedValue(
        new Error('Directory error')
      );

      await expect(modelManager.initialize()).rejects.toThrow(
        'Failed to initialize model manager'
      );
    });
  });

  describe('getModelInfo', () => {
    it('should return current model info', () => {
      expect(modelManager.getModelInfo()).toBeNull();

      (modelManager as any).modelInfo = mockModelInfo;
      expect(modelManager.getModelInfo()).toEqual(mockModelInfo);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true when model file exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        uri: '',
        size: 1000,
        isDirectory: false,
        modificationTime: 0,
      });

      const result = await modelManager.isModelAvailable();

      expect(result).toBe(true);
      expect(mockGetModelPaths).toHaveBeenCalled();
    });

    it('should return false when model file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false,
        uri: '',
        size: 0,
        isDirectory: false,
        modificationTime: 0,
      });

      const result = await modelManager.isModelAvailable();

      expect(result).toBe(false);
    });
  });

  describe('validateModelChecksum', () => {
    it('should delegate to validateModelChecksum function', async () => {
      const expectedResult = { valid: true, actualChecksum: 'abc123' };
      mockValidateModelChecksum.mockResolvedValue(expectedResult);

      const result = await modelManager.validateModelChecksum('expected');

      expect(result).toEqual(expectedResult);
      expect(mockValidateModelChecksum).toHaveBeenCalledWith('expected');
    });
  });

  describe('loadModelMetadata', () => {
    it('should load and set model metadata', async () => {
      mockLoadModelMetadata.mockResolvedValue(mockModelInfo);

      const result = await modelManager.loadModelMetadata();

      expect(result).toEqual(mockModelInfo);
      expect(modelManager.getModelInfo()).toEqual(mockModelInfo);
      expect(mockLoadModelMetadata).toHaveBeenCalled();
    });
  });

  describe('saveModelMetadata', () => {
    it('should save metadata and update internal state', async () => {
      mockSaveModelMetadata.mockResolvedValue(mockModelInfo);

      await modelManager.saveModelMetadata(mockModelInfo);

      expect(mockSaveModelMetadata).toHaveBeenCalledWith(mockModelInfo);
      expect(modelManager.getModelInfo()).toEqual(mockModelInfo);
    });
  });

  describe('downloadModel', () => {
    it('should delegate to downloadModel function', async () => {
      mockDownloadModel.mockResolvedValue(undefined);

      await modelManager.downloadModel('1.0.0', { timeout: 5000 });

      expect(mockDownloadModel).toHaveBeenCalledWith('1.0.0', {
        timeout: 5000,
      });
    });
  });

  describe('updateModel', () => {
    it('should update model and set metadata', async () => {
      mockUpdateModel.mockResolvedValue(mockModelInfo);

      await modelManager.updateModel('1.0.0', { timeout: 5000 });

      expect(mockUpdateModel).toHaveBeenCalledWith('1.0.0', { timeout: 5000 });
      expect(modelManager.getModelInfo()).toEqual(mockModelInfo);
    });
  });

  describe('deleteModel', () => {
    it('should delete model and clear metadata', async () => {
      (modelManager as any).modelInfo = mockModelInfo;
      mockDeleteModel.mockResolvedValue(undefined);

      await modelManager.deleteModel();

      expect(mockDeleteModel).toHaveBeenCalled();
      expect(modelManager.getModelInfo()).toBeNull();
    });
  });

  describe('getModelSize', () => {
    it('should delegate to getModelSize function', async () => {
      mockGetModelSize.mockResolvedValue(10.5);

      const result = await modelManager.getModelSize();

      expect(result).toBe(10.5);
      expect(mockGetModelSize).toHaveBeenCalled();
    });
  });

  describe('validateModelSize', () => {
    it('should delegate to validateModelSize function', async () => {
      mockValidateModelSize.mockResolvedValue(true);

      const result = await modelManager.validateModelSize();

      expect(result).toBe(true);
      expect(mockValidateModelSize).toHaveBeenCalled();
    });
  });
});

describe('getModelManager', () => {
  it('should return singleton instance', () => {
    const instance1 = getModelManager();
    const instance2 = getModelManager();

    expect(instance1).toBe(instance2);
    expect(instance1).toBeInstanceOf(ModelManager);
  });
});
