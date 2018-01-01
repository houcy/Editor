import {
    Scene,
    VertexBuffer,
    MaterialDefines, PushMaterial, MaterialHelper, EffectFallbacks, EffectCreationOptions,
    serialize, serializeAsColor3, serializeAsTexture, expandToProperty,
    Nullable,
    BaseTexture,
    Color3, Matrix,
    AbstractMesh, SubMesh, Mesh, IAnimatable,
    StandardMaterial,
    SerializationHelper
} from 'babylonjs';
import { serializeAsColor4 } from 'babylonjs-materials';

/**
 * Custom Material class
 */
class CustomMaterialDefines extends MaterialDefines {
    public DIFFUSE = false;
    public CLIPPLANE = false;
    public ALPHATEST = false;
    public DEPTHPREPASS = false;
    public POINTSIZE = false;
    public FOG = false;
    public NORMAL = false;
    public UV1 = false;
    public UV2 = false;
    public VERTEXCOLOR = false;
    public VERTEXALPHA = false;
    public NUM_BONE_INFLUENCERS = 0;
    public BonesPerMesh = 0;
    public INSTANCES = false;

    constructor() {
        super();
        this.rebuild();
    }
}

/**
 * The custom material code interface which
 * comes from the user
 */
export interface CustomMaterialCode {
    constructor: () => void;
    isReadyForSubMesh: (mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean) => boolean;
    bindForSubMesh: (world: Matrix, mesh: Mesh, subMesh: SubMesh) => void;
    dispose: () => void;
    serialize: (serializationObject: any) => any;
    parse: (source: any) => void;
}

/**
 * Custom material class
 */
export class CustomMaterial extends PushMaterial {
    @serializeAsTexture('diffuseTexture')
    private _diffuseTexture: BaseTexture;
    @expandToProperty('_markAllSubMeshesAsTexturesDirty')
    public diffuseTexture: BaseTexture;

    @serializeAsColor3('diffuse')
    public diffuseColor = new Color3(1, 1, 1);

    @serialize('disableLighting')
    private _disableLighting = false;
    @expandToProperty('_markAllSubMeshesAsLightsDirty')
    public disableLighting: boolean;

    @serialize('maxSimultaneousLights')
    private _maxSimultaneousLights = 4;
    @expandToProperty('_markAllSubMeshesAsLightsDirty')
    public maxSimultaneousLights: number;

    private _renderId: number;

    private _customCode: CustomMaterialCode;

    /**
     * Constructor
     * @param name: the name of the material 
     * @param scene: the scene reference
     */
    constructor(name: string, scene: Scene, customCode: CustomMaterialCode) {
        super(name, scene);

        this._customCode = customCode;
        this._customCode.constructor.call(this);
    }

    public needAlphaBlending(): boolean {
        return (this.alpha < 1.0);
    }

    public needAlphaTesting(): boolean {
        return false;
    }

    public getAlphaTestTexture(): Nullable<BaseTexture> {
        return null;
    }

    // Methods
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        if (this.isFrozen) {
            if (this._wasPreviouslyReady && subMesh.effect) {
                return true;
            }
        }

        if (!subMesh._materialDefines) {
            subMesh._materialDefines = new CustomMaterialDefines();
        }

        var defines = <CustomMaterialDefines>subMesh._materialDefines;
        var scene = this.getScene();

        if (!this.checkReadyOnEveryCall && subMesh.effect) {
            if (this._renderId === scene.getRenderId()) {
                return true;
            }
        }

        var engine = scene.getEngine();

        // Textures
        if (defines._areTexturesDirty) {
            defines._needUVs = false;
            if (scene.texturesEnabled) {
                if (this._diffuseTexture && StandardMaterial.DiffuseTextureEnabled) {
                    if (!this._diffuseTexture.isReady()) {
                        return false;
                    } else {
                        defines._needUVs = true;
                        defines.DIFFUSE = true;
                    }
                }
            }
        }

        // Misc.
        MaterialHelper.PrepareDefinesForMisc(mesh, scene, false, this.pointsCloud, this.fogEnabled, defines);

        // Lights
        defines._needNormals = MaterialHelper.PrepareDefinesForLights(scene, mesh, defines, false, this._maxSimultaneousLights, this._disableLighting);

        // Values that need to be evaluated on every frame
        MaterialHelper.PrepareDefinesForFrameBoundValues(scene, engine, defines, useInstances ? true : false);

        // Attribs
        MaterialHelper.PrepareDefinesForAttributes(mesh, defines, true, true);

        // Get correct effect      
        if (defines.isDirty) {
            defines.markAsProcessed();
            scene.resetCachedMaterial();

            // Fallbacks
            var fallbacks = new EffectFallbacks();
            if (defines.FOG) {
                fallbacks.addFallback(1, 'FOG');
            }

            MaterialHelper.HandleFallbacksForShadows(defines, fallbacks, this.maxSimultaneousLights);

            if (defines.NUM_BONE_INFLUENCERS > 0) {
                fallbacks.addCPUSkinningFallback(0, mesh);
            }

            //Attributes
            var attribs = [VertexBuffer.PositionKind];

            if (defines.NORMAL) {
                attribs.push(VertexBuffer.NormalKind);
            }

            if (defines.UV1) {
                attribs.push(VertexBuffer.UVKind);
            }

            if (defines.UV2) {
                attribs.push(VertexBuffer.UV2Kind);
            }

            if (defines.VERTEXCOLOR) {
                attribs.push(VertexBuffer.ColorKind);
            }

            MaterialHelper.PrepareAttributesForBones(attribs, mesh, defines, fallbacks);
            MaterialHelper.PrepareAttributesForInstances(attribs, defines);

            var shaderName = this.name;
            var join = defines.toString();
            var uniforms = ['world', 'view', 'viewProjection', 'vEyePosition', 'vLightsType', 'vDiffuseColor',
                'vFogInfos', 'vFogColor', 'pointSize',
                'vDiffuseInfos',
                'mBones',
                'vClipPlane', 'diffuseMatrix'
            ];
            var samplers = ['diffuseSampler'];
            var uniformBuffers = new Array<string>()

            MaterialHelper.PrepareUniformsAndSamplersList(<EffectCreationOptions>{
                uniformsNames: uniforms,
                uniformBuffersNames: uniformBuffers,
                samplers: samplers,
                defines: defines,
                maxSimultaneousLights: this.maxSimultaneousLights
            });
            subMesh.setEffect(scene.getEngine().createEffect(shaderName,
                <EffectCreationOptions>{
                    attributes: attribs,
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: join,
                    fallbacks: fallbacks,
                    onCompiled: this.onCompiled,
                    onError: this.onError,
                    indexParameters: { maxSimultaneousLights: this._maxSimultaneousLights - 1 }
                }, engine), defines);

        }
        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        this._renderId = scene.getRenderId();
        this._wasPreviouslyReady = true;

        return true;
    }

    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        var scene = this.getScene();

        var defines = <CustomMaterialDefines>subMesh._materialDefines;
        if (!defines) {
            return;
        }

        var effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;

        // Matrices        
        this.bindOnlyWorldMatrix(world);
        this._activeEffect.setMatrix('viewProjection', scene.getTransformMatrix());

        // Bones
        MaterialHelper.BindBonesParameters(mesh, this._activeEffect);

        if (this._mustRebind(scene, effect)) {
            // Textures        
            if (this._diffuseTexture && StandardMaterial.DiffuseTextureEnabled) {
                this._activeEffect.setTexture('diffuseSampler', this._diffuseTexture);

                this._activeEffect.setFloat2('vDiffuseInfos', this._diffuseTexture.coordinatesIndex, this._diffuseTexture.level);
                this._activeEffect.setMatrix('diffuseMatrix', this._diffuseTexture.getTextureMatrix());
            }

            // Clip plane
            MaterialHelper.BindClipPlane(this._activeEffect, scene);

            // Point size
            if (this.pointsCloud) {
                this._activeEffect.setFloat('pointSize', this.pointSize);
            }

            MaterialHelper.BindEyePosition(effect, scene);
        }

        this._activeEffect.setColor4('vDiffuseColor', this.diffuseColor, this.alpha * mesh.visibility);

        // Lights
        if (scene.lightsEnabled && !this.disableLighting) {
            MaterialHelper.BindLights(scene, mesh, this._activeEffect, defines, this.maxSimultaneousLights);
        }

        // View
        if (scene.fogEnabled && mesh.applyFog && scene.fogMode !== Scene.FOGMODE_NONE) {
            this._activeEffect.setMatrix('view', scene.getViewMatrix());
        }

        // Fog
        MaterialHelper.BindFogParameters(scene, mesh, this._activeEffect);

        this._afterBind(mesh, this._activeEffect);
    }

    public getAnimatables(): IAnimatable[] {
        var results = [];

        if (this._diffuseTexture && this._diffuseTexture.animations && this._diffuseTexture.animations.length > 0) {
            results.push(this._diffuseTexture);
        }

        return results;
    }

    public getActiveTextures(): BaseTexture[] {
        var activeTextures = super.getActiveTextures();

        if (this._diffuseTexture) {
            activeTextures.push(this._diffuseTexture);
        }

        return activeTextures;
    }

    public hasTexture(texture: BaseTexture): boolean {
        if (super.hasTexture(texture)) {
            return true;
        }

        if (this.diffuseTexture === texture) {
            return true;
        }

        return false;
    }

    public dispose(forceDisposeEffect?: boolean): void {
        if (this._diffuseTexture) {
            this._diffuseTexture.dispose();
        }

        super.dispose(forceDisposeEffect);
    }

    public clone(name: string): CustomMaterial {
        return SerializationHelper.Clone<CustomMaterial>(() => new CustomMaterial(name, this.getScene(), this._customCode), this);
    }

    public serialize(): any {
        var serializationObject = SerializationHelper.Serialize(this);
        serializationObject.customType = 'BABYLON.CustomMaterial';
        return serializationObject;
    }

    public getClassName(): string {
        return 'CustomMaterial';
    }

    // Statics
    public static Parse(source: any, scene: Scene, rootUrl: string): CustomMaterial {
        return SerializationHelper.Parse(() => new CustomMaterial(source.name, scene, null), source, scene, rootUrl);
    }
}
