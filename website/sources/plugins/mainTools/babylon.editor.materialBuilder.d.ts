declare module BABYLON.EDITOR {
    class MaterialBuilder implements ITabApplication {
        private _core;
        private _engine;
        private _scene;
        private _camera;
        private _box;
        private _ground;
        private _skybox;
        private _pointLight;
        private _hemisphericLight;
        private _directionalLight;
        private _spotLight;
        private _containerElement;
        private _containerID;
        private _tab;
        private _layouts;
        private _editLayouts;
        private _toolbar;
        private _codePanel;
        private _vertexTabId;
        private _pixelTabId;
        private _configTabId;
        private _currentTabId;
        private _codeEditor;
        private _editForm;
        private _extension;
        private _mainExtension;
        private _currentMetadata;
        private _sceneConfig;
        static _VertexShaderString: string;
        static _PixelShaderString: string;
        /**
        * Constructor
        * @param core: the editor core
        */
        constructor(core: EditorCore);
        /**
        * Disposes the application
        */
        dispose(): void;
        private _buildMaterial(releaseOnScene?);
        private _buildEditForm();
        private _changeTextureForm(folder, textures, config, indice);
        private _createUI();
        private _onTabChanged(id);
        private _onCodeEditorChanged();
        private _loadShaderFiles(callback);
        private _getMetadatas();
        private _storeMetadatas(data);
        private _createSelectionWindow(core);
    }
}
