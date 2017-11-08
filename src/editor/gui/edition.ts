import {
    Color3, Color4,
    Vector2, Vector3, Vector4,
    Scene, BaseTexture, CubeTexture
} from 'babylonjs';
import * as dat from 'dat-gui';

import Tools from '../tools/tools';

export default class Edition {
    // Public member
    public element: dat.GUI;

    /**
     * Constructor
     */
    constructor()
    { }

    /**
     * Adds a folder
     * @param name the folder name
     */
    public addFolder (name: string): dat.GUI {
        return this.element.addFolder(name);
    }

    /**
     * Add a gui controller
     * @param target the target object
     * @param propName the property of the object
     */
    public add (target: any, propName: string): dat.GUIController {
        return this.element.add(target, propName);
    }

    /**
     * Removes the dat element
     */
    public remove (): void {
        this.element.destroy();
        this.element.domElement.parentNode.removeChild(this.element.domElement);

        this.element = null;
    }

    /**
     * Call the given callback on each recursive onFinishChange
     * @param folder the root folder
     * @param callback the callback when a property changed
     */
    public onFinishChange (folder: dat.GUI, callback: (property: string, result: any) => void): void {
        if (!folder)
            folder = this.element;

        folder.__controllers.forEach(c => {
            const existingFn = c['__onFinishChange'];
            c.onFinishChange((result) => {
                if (existingFn)
                    existingFn(result);

                callback(c['property'], result);
            });
        });

        for (const f in folder.__folders)
            this.onFinishChange(folder.__folders[f], callback);
    }

    /**
     * Call the given callback on each recursive onChange
     * @param folder the root folder
     * @param callback the callback when a property changed
     */
    public onChange (folder: dat.GUI, callback: (property: string, result: any) => void): void {
        if (!folder)
            folder = this.element;

        folder.__controllers.forEach(c => {
            const existingFn = c['__onChange'];
            c.onChange((result) => {
                if (existingFn)
                    existingFn(result);
                callback(c['property'], result);
            });
        });

        for (const f in folder.__folders)
            this.onChange(folder.__folders[f], callback);
    }

    /**
     * Returns a controller identified by its property name
     * @param property the property used by the controller
     * @param parent the parent folder
     */
    public getController (property: string, parent = this.element): dat.GUIController {
        const controller = parent.__controllers.find(c => c['property'] === property);
        return controller;
    }

    /**
     * Build the edition tool
     * @param parentId the parent id (dom element)
     */
    public build (parentId: string): void {
        const parent = $('#' + parentId);

        this.element = new dat.GUI(<dat.GUIParams> {
            autoPlace: false,
            scrollable: true
        });
        this.element.useLocalStorage = true;
        this.element.width = parent.width();

        parent[0].appendChild(this.element.domElement);

        Tools.ImportScript('./css/dat.gui.css');
    }

    /**
     * Adds a color element
     * @param parent the parent folder
     * @param name the name of the folder
     * @param color the color reference
     */
    public addColor (parent: dat.GUI, name: string, color: Color3 | Color4): dat.GUI {
        const target = {
            color: color.asArray()
        };

        const folder = parent.addFolder(name);
        folder.addColor(target, 'color').name('Color').onChange((value: number[]) => {
            this.getController('r', folder).setValue(value[0] / 255);
            this.getController('g', folder).setValue(value[1] / 255);
            this.getController('b', folder).setValue(value[2] / 255);
        });
        folder.add(color, 'r').step(0.01);
        folder.add(color, 'g').step(0.01);
        folder.add(color, 'b').step(0.01);

        if (color instanceof Color4) {
            // Sometimes, color.a is undefined
            color.a = color.a || 0;

            folder.add(color, 'a').step(0.01);
        }

        return folder;
    }

    /**
     * Adds a position element
     * @param parent the parent folder
     * @param name the name of the folder
     * @param vector the vector reference
     */
    public addVector(parent: dat.GUI, name: string, vector: Vector2 | Vector3 | Vector4, callback?: () => void): dat.GUI {
        const folder = parent.addFolder(name);
        folder.add(vector, 'x').step(0.01).onChange(() => callback && callback());
        folder.add(vector, 'y').step(0.01).onChange(() => callback && callback());

        if (vector instanceof Vector3 || vector instanceof Vector4)
        folder.add(vector, 'z').step(0.01).onChange(() => callback && callback());

        if (vector instanceof Color4)
            folder.add(vector, 'w').step(0.01).onChange(() => callback && callback());

        return folder;
    }

    /**
     * Adds a texture controller
     * @param parent the parent folder
     * @param scene the scene containing the textures
     * @param property the property of the object
     * @param object the object which has a texture
     * @param callback: called when changed texture
     */
    public addTexture(parent: dat.GUI, scene: Scene, property: string, object: any, allowCubes: boolean = false, callback?: (texture: BaseTexture) => void): dat.GUIController {
        const textures = ['None'];
        scene.textures.forEach(t => {
            if (t instanceof CubeTexture && !allowCubes)
                return;

            textures.push(t.name);
        });

        const target = {
            active: object[property] ? object[property].name : 'None'
        };

        const controller = parent.add(target, 'active', textures);
        controller.onFinishChange(r => {
            const texture = scene.textures.find(t => t.name === r);
            object[property] = texture;

            callback && callback(texture);
        });

        return controller;
    }
}
