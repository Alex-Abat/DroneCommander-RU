const draftId = new URLSearchParams(window.location.search).get('draft');
const draftKey = draftId ? `droneCommanderMapEditorDraft:${draftId}` : '';
const resultKey = draftId ? `droneCommanderMapEditorResult:${draftId}` : '';
const draft = draftKey ? JSON.parse(localStorage.getItem(draftKey) || 'null') : null;
const language = draft && draft.language === 'ru' ? 'ru' : 'en';
const translations = {
    ru: {
        name: 'Название карты',
        apply: 'Передать в приложение',
        close: 'Закрыть вкладку',
        objects: 'Объекты карты',
        model: 'Добавить объект',
        add: 'Добавить',
        view: 'Карта',
        status: 'Загрузка сцены…',
        camera: 'Сбросить камеру',
        surface: 'Поверхность',
        texture: 'Текстура',
        hills: 'Высота холмов',
        transform: 'Трансформация',
        empty: 'Выберите объект на карте или в списке.',
        position: 'Положение',
        rotation: 'Поворот, градусы',
        scale: 'Масштаб',
        remove: 'Удалить объект',
        sent: 'Изменения переданы в основную вкладку.',
        noParent: 'Эта вкладка открыта без черновика из приложения.',
        missingDraft: 'Черновик карты не найден. Вернитесь в приложение и откройте редактор ещё раз.',
        models: {
            'albero.obj': 'Дерево',
            'barca.obj': 'Лодка',
            'city.obj': 'Городской квартал',
            'isoletta.obj': 'Островок',
            '2cv_car_yellow_0430162344_refine.obj': 'Автомобиль',
            'little_house_with_a_g_0430133251_refine.obj': 'Дом',
            'panchina.obj': 'Скамейка'
        },
        textures: {
            'grass.jpg': 'Трава',
            'grass2.jpg': 'Трава 2',
            'sand.jpg': 'Песок',
            'sea.jpg': 'Вода',
            'town.jpg': 'Город'
        }
    },
    en: {
        name: 'Map name',
        apply: 'Send to app',
        close: 'Close tab',
        objects: 'Map objects',
        model: 'Add object',
        add: 'Add',
        view: 'Map',
        status: 'Loading scene…',
        camera: 'Reset camera',
        surface: 'Surface',
        texture: 'Texture',
        hills: 'Hill height',
        transform: 'Transform',
        empty: 'Select an object on the map or in the list.',
        position: 'Position',
        rotation: 'Rotation, degrees',
        scale: 'Scale',
        remove: 'Remove object',
        sent: 'Changes sent to the main tab.',
        noParent: 'This tab was opened without a draft from the app.',
        missingDraft: 'Map draft not found. Return to the app and open the editor again.',
        models: {
            'albero.obj': 'Tree',
            'barca.obj': 'Boat',
            'city.obj': 'City block',
            'isoletta.obj': 'Small island',
            '2cv_car_yellow_0430162344_refine.obj': 'Car',
            'little_house_with_a_g_0430133251_refine.obj': 'House',
            'panchina.obj': 'Bench'
        },
        textures: {
            'grass.jpg': 'Grass',
            'grass2.jpg': 'Grass 2',
            'sand.jpg': 'Sand',
            'sea.jpg': 'Water',
            'town.jpg': 'Town'
        }
    }
};
const text = translations[language];
const modelCatalog = [
    { model: 'albero.obj', material: 'albero.mtl', scale: 4 },
    { model: 'barca.obj', material: 'barca.mtl', scale: 100 },
    { model: 'city.obj', material: 'city.mtl', scale: 200 },
    { model: 'isoletta.obj', material: 'isoletta.mtl', scale: 500 },
    {
        model: '2cv_car_yellow_0430162344_refine.obj',
        material: '2cv_car_yellow_0430162344_refine.mtl',
        scale: 15
    },
    {
        model: 'little_house_with_a_g_0430133251_refine.obj',
        material: 'little_house_with_a_g_0430133251_refine.mtl',
        scale: 50
    },
    { model: 'panchina.obj', material: 'panchina.mtl', scale: 15 }
];
const textureCatalog = ['grass.jpg', 'grass2.jpg', 'sand.jpg', 'sea.jpg', 'town.jpg'];
const defaultData = {
    groundTexture: 'grass.jpg',
    hillHeight: 25,
    objects: []
};
const mapNameInput = document.getElementById('mapNameInput');
const mapViewport = document.getElementById('mapViewport');
const editorStatus = document.getElementById('editorStatus');
const viewportMessage = document.getElementById('viewportMessage');
const objectList = document.getElementById('objectList');
const transformFields = document.getElementById('transformFields');
const emptySelection = document.getElementById('emptySelection');
const modelCache = new Map();
let sourceData = draft && draft.data && typeof draft.data === 'object' ? draft.data : defaultData;
let objects = Array.isArray(sourceData.objects) ? sourceData.objects.map(normalizeObject) : [];
let selectedIndex = -1;
let roots = [];
let selectedHelper = null;
let scene;
let camera;
let renderer;
let ground;
let groundTextureLoadId = 0;
let animationFrame;
let orbitTheta = Math.PI / 4;
let orbitPhi = 0.95;
let orbitRadius = 1700;
let isOrbiting = false;
let isDraggingObject = false;
let pointerMoved = false;
let pointerStart = { x: 0, y: 0 };
let dragOffset = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersectionPoint = new THREE.Vector3();

function normalizeObject(object) {
    const catalogEntry = modelCatalog.find(entry => entry.model === object.model);
    return {
        ...object,
        material: object.material || (catalogEntry && catalogEntry.material) || '',
        position: {
            x: Number(object.position && object.position.x) || 0,
            y: Number(object.position && object.position.y) || 0,
            z: Number(object.position && object.position.z) || 0
        },
        rotation: {
            x: Number(object.rotation && object.rotation.x) || 0,
            y: Number(object.rotation && object.rotation.y) || 0,
            z: Number(object.rotation && object.rotation.z) || 0
        },
        scale: Number(object.scale) || (catalogEntry && catalogEntry.scale) || 1
    };
}

function setLocalizedText() {
    document.documentElement.lang = language;
    document.documentElement.dir = draft && draft.language === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('dark-theme', Boolean(draft && draft.darkTheme));
    document.getElementById('mapNameLabel').textContent = text.name;
    document.getElementById('applyMapBtn').textContent = text.apply;
    document.getElementById('closeMapBtn').textContent = text.close;
    document.getElementById('objectsHeading').textContent = text.objects;
    document.getElementById('modelSelectLabel').textContent = text.model;
    document.getElementById('addObjectBtn').textContent = text.add;
    document.getElementById('viewportTitle').textContent = text.view;
    document.getElementById('resetCameraBtn').textContent = text.camera;
    document.getElementById('surfaceHeading').textContent = text.surface;
    document.getElementById('textureLabel').textContent = text.texture;
    document.getElementById('hillHeightLabel').textContent = text.hills;
    document.getElementById('transformHeading').textContent = text.transform;
    document.getElementById('emptySelection').textContent = text.empty;
    document.getElementById('positionHeading').textContent = text.position;
    document.getElementById('rotationHeading').textContent = text.rotation;
    document.getElementById('scaleLabel').textContent = text.scale;
    document.getElementById('removeObjectBtn').textContent = text.remove;
    document.getElementById('resetCameraBtn').title = text.camera;
}

function populateSelects() {
    const modelSelect = document.getElementById('modelSelect');
    modelCatalog.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.model;
        option.textContent = text.models[entry.model] || entry.model;
        modelSelect.appendChild(option);
    });

    const textureSelect = document.getElementById('textureSelect');
    textureCatalog.forEach(texture => {
        const option = document.createElement('option');
        option.value = texture;
        option.textContent = text.textures[texture] || texture;
        textureSelect.appendChild(option);
    });
    const currentTexture = sourceData.groundTexture || 'grass.jpg';
    if (!textureCatalog.includes(currentTexture)) {
        const option = document.createElement('option');
        option.value = currentTexture;
        option.textContent = currentTexture;
        textureSelect.appendChild(option);
    }
    textureSelect.value = currentTexture;
    document.getElementById('hillHeightInput').value = Number(sourceData.hillHeight) || 0;
    mapNameInput.value = draft && draft.name ? draft.name : '';
}

function createTerrainGeometry(height) {
    const geometry = new THREE.PlaneGeometry(4100, 4100, 32, 32);
    const vertices = geometry.vertices;
    for (let index = 0; index < vertices.length; index++) {
        const vertex = vertices[index];
        const distance = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);
        if (distance < 200) {
            vertex.z = 0;
        } else {
            const rx = Math.random() * 0.999 + 0.001;
            const ry = Math.random() * 0.999 + 0.001;
            vertex.z = height * Math.sin(vertex.x * rx) * Math.cos(vertex.y * ry);
        }
    }
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    return geometry;
}

function setGroundTexture(fileName) {
    const loadId = ++groundTextureLoadId;
    new THREE.TextureLoader().load(`textures/${fileName}`, texture => {
        if (loadId !== groundTextureLoadId) {
            texture.dispose();
            return;
        }
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4100 / 1024, 4100 / 1024);
        if (ground.material.map) ground.material.map.dispose();
        ground.material.map = texture;
        ground.material.needsUpdate = true;
    }, undefined, error => {
        editorStatus.textContent = `${fileName}: ${error.message || 'texture unavailable'}`;
    });
}

function updateTerrain() {
    const height = Number(document.getElementById('hillHeightInput').value) || 0;
    const oldGeometry = ground.geometry;
    ground.geometry = createTerrainGeometry(height);
    oldGeometry.dispose();
    setGroundTexture(document.getElementById('textureSelect').value);
}

function loadModelTemplate(objectData) {
    const cacheKey = `${objectData.model}|${objectData.material}`;
    if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
    const promise = new Promise(resolve => {
        const materialLoader = new THREE.MTLLoader();
        materialLoader.setPath('models/');
        materialLoader.load(objectData.material, materials => {
            materials.preload();
            const objectLoader = new THREE.OBJLoader();
            objectLoader.setMaterials(materials);
            objectLoader.setPath('models/');
            objectLoader.load(objectData.model, resolve, undefined, () => resolve(null));
        }, undefined, () => resolve(null));
    });
    modelCache.set(cacheKey, promise);
    return promise;
}

async function createObjectRoot(objectData, index) {
    const root = new THREE.Group();
    const template = objectData.material ? await loadModelTemplate(objectData) : null;
    if (template) {
        root.add(template.clone(true));
    } else {
        const placeholder = new THREE.Mesh(
            new THREE.BoxGeometry(18, 18, 18),
            new THREE.MeshLambertMaterial({ color: 0xd46b45 })
        );
        root.add(placeholder);
    }
    root.userData.mapIndex = index;
    root.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
    root.rotation.set(
        THREE.MathUtils.degToRad(objectData.rotation.x),
        THREE.MathUtils.degToRad(objectData.rotation.y),
        THREE.MathUtils.degToRad(objectData.rotation.z)
    );
    root.scale.setScalar(objectData.scale);
    root.traverse(child => {
        if (!child.isMesh) return;
        child.userData.mapRoot = root;
        child.castShadow = true;
        child.receiveShadow = true;
    });
    scene.add(root);
    roots[index] = root;
    return root;
}

function displayModelName(objectData) {
    return text.models[objectData.model] || objectData.model || 'Object';
}

function renderObjectList() {
    objectList.replaceChildren();
    objects.forEach((objectData, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-selected', String(index === selectedIndex));
        button.title = displayModelName(objectData);
        const number = document.createElement('span');
        number.className = 'object-index';
        number.textContent = String(index + 1).padStart(2, '0');
        const name = document.createElement('span');
        name.className = 'object-name';
        name.textContent = displayModelName(objectData);
        button.append(number, name);
        button.addEventListener('click', () => selectObject(index));
        item.appendChild(button);
        objectList.appendChild(item);
    });
    document.getElementById('objectCount').textContent = String(objects.length);
}

function selectObject(index) {
    selectedIndex = index;
    renderObjectList();
    const selected = index >= 0 && objects[index] ? objects[index] : null;
    emptySelection.hidden = Boolean(selected);
    transformFields.hidden = !selected;
    document.getElementById('removeObjectBtn').disabled = !selected;
    if (selected) {
        document.querySelectorAll('[data-transform]').forEach(input => {
            const [group, axis] = input.dataset.transform.split('.');
            input.value = group === 'scale' ? selected.scale : selected[group][axis];
        });
    }
    if (selectedHelper) {
        scene.remove(selectedHelper);
        selectedHelper.geometry.dispose();
        selectedHelper.material.dispose();
        selectedHelper = null;
    }
    if (selected && roots[index]) {
        selectedHelper = new THREE.BoxHelper(roots[index], 0xd46b45);
        scene.add(selectedHelper);
    }
}

function applyObjectTransform(index) {
    const objectData = objects[index];
    const root = roots[index];
    if (!objectData || !root) return;
    root.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
    root.rotation.set(
        THREE.MathUtils.degToRad(objectData.rotation.x),
        THREE.MathUtils.degToRad(objectData.rotation.y),
        THREE.MathUtils.degToRad(objectData.rotation.z)
    );
    root.scale.setScalar(objectData.scale);
    if (selectedHelper && selectedIndex === index) selectedHelper.update();
}

function bindControls() {
    document.getElementById('textureSelect').addEventListener('change', updateTerrain);
    document.getElementById('hillHeightInput').addEventListener('change', updateTerrain);
    document.getElementById('addObjectBtn').addEventListener('click', async () => {
        const entry = modelCatalog.find(model =>
            model.model === document.getElementById('modelSelect').value);
        if (!entry) return;
        const index = objects.length;
        const objectData = normalizeObject({
            ...entry,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        });
        objects.push(objectData);
        renderObjectList();
        await createObjectRoot(objectData, index);
        selectObject(index);
    });
    document.getElementById('removeObjectBtn').addEventListener('click', () => {
        if (selectedIndex < 0) return;
        const removedRoot = roots[selectedIndex];
        if (removedRoot) scene.remove(removedRoot);
        objects.splice(selectedIndex, 1);
        roots.splice(selectedIndex, 1);
        roots.forEach((root, index) => {
            root.userData.mapIndex = index;
            root.traverse(child => {
                if (child.isMesh) child.userData.mapRoot = root;
            });
        });
        selectObject(-1);
    });
    document.querySelectorAll('[data-transform]').forEach(input => {
        input.addEventListener('change', () => {
            if (selectedIndex < 0) return;
            const [group, axis] = input.dataset.transform.split('.');
            const value = Number(input.value);
            if (!Number.isFinite(value)) return;
            if (group === 'scale') {
                if (value <= 0) return;
                objects[selectedIndex].scale = value;
            } else {
                objects[selectedIndex][group][axis] = value;
            }
            applyObjectTransform(selectedIndex);
        });
    });
    document.getElementById('resetCameraBtn').addEventListener('click', resetCamera);
    document.getElementById('closeMapBtn').addEventListener('click', () => window.close());
    document.getElementById('applyMapBtn').addEventListener('click', applyMapToMainTab);
    window.addEventListener('keydown', event => {
        if (event.key === 'Delete' && selectedIndex >= 0 &&
            !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            document.getElementById('removeObjectBtn').click();
        }
    });
}

function setPointerRay(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
}

function getGroundPoint(event) {
    setPointerRay(event);
    return raycaster.ray.intersectPlane(groundPlane, intersectionPoint) ?
        intersectionPoint.clone() : null;
}

function bindViewportControls() {
    renderer.domElement.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        renderer.domElement.setPointerCapture(event.pointerId);
        pointerStart = { x: event.clientX, y: event.clientY };
        pointerMoved = false;
        setPointerRay(event);
        const hits = raycaster.intersectObjects(scene.children, true);
        const objectHit = hits.find(hit => hit.object.userData.mapRoot);
        if (objectHit) {
            const root = objectHit.object.userData.mapRoot;
            selectObject(root.userData.mapIndex);
            const point = getGroundPoint(event);
            if (point) {
                dragOffset.set(root.position.x - point.x, 0, root.position.z - point.z);
                isDraggingObject = true;
            }
        } else {
            selectObject(-1);
            isOrbiting = true;
        }
    });
    renderer.domElement.addEventListener('pointermove', event => {
        if (!isOrbiting && !isDraggingObject) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) pointerMoved = true;
        if (isDraggingObject && selectedIndex >= 0) {
            const point = getGroundPoint(event);
            if (!point) return;
            const objectData = objects[selectedIndex];
            objectData.position.x = Math.round((point.x + dragOffset.x) * 10) / 10;
            objectData.position.z = Math.round((point.z + dragOffset.z) * 10) / 10;
            applyObjectTransform(selectedIndex);
            document.querySelectorAll('[data-transform]').forEach(input => {
                if (input.dataset.transform === 'position.x') input.value = objectData.position.x;
                if (input.dataset.transform === 'position.z') input.value = objectData.position.z;
            });
        } else if (isOrbiting) {
            orbitTheta -= deltaX * 0.006;
            orbitPhi = Math.max(0.15, Math.min(Math.PI / 2.05, orbitPhi + deltaY * 0.005));
        }
        pointerStart = { x: event.clientX, y: event.clientY };
        updateCameraPosition();
    });
    const endPointer = () => {
        isOrbiting = false;
        isDraggingObject = false;
    };
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    renderer.domElement.addEventListener('wheel', event => {
        event.preventDefault();
        orbitRadius = Math.max(250, Math.min(5000, orbitRadius * (event.deltaY > 0 ? 1.08 : 0.92)));
        updateCameraPosition();
    }, { passive: false });
}

function updateCameraPosition() {
    camera.position.set(
        orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
        orbitRadius * Math.cos(orbitPhi),
        orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
    );
    camera.lookAt(0, 0, 0);
}

function resetCamera() {
    orbitTheta = Math.PI / 4;
    orbitPhi = 0.95;
    orbitRadius = 1700;
    updateCameraPosition();
}

function resizeRenderer() {
    const width = mapViewport.clientWidth;
    const height = mapViewport.clientHeight;
    if (!width || !height || !renderer) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function animate() {
    animationFrame = requestAnimationFrame(animate);
    if (selectedHelper) selectedHelper.update();
    renderer.render(scene, camera);
}

function applyMapToMainTab() {
    if (!resultKey) {
        viewportMessage.textContent = text.noParent;
        viewportMessage.hidden = false;
        return;
    }
    const data = {
        ...sourceData,
        groundTexture: document.getElementById('textureSelect').value,
        hillHeight: Number(document.getElementById('hillHeightInput').value) || 0,
        objects: objects.map(object => ({
            ...object,
            position: { ...object.position },
            rotation: { ...object.rotation }
        }))
    };
    localStorage.setItem(resultKey, JSON.stringify({
        name: mapNameInput.value.trim(),
        data,
        savedAt: Date.now()
    }));
    editorStatus.textContent = text.sent;
}

async function initMapEditor() {
    setLocalizedText();
    populateSelects();
    bindControls();
    if (!draft) {
        viewportMessage.textContent = text.missingDraft;
        viewportMessage.hidden = false;
        document.getElementById('applyMapBtn').disabled = true;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fc4d0);
    scene.fog = new THREE.Fog(0x9fc4d0, 2600, 7000);
    camera = new THREE.PerspectiveCamera(48, 1, 1, 12000);
    resetCamera();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mapViewport.prepend(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.05);
    sunLight.position.set(-700, 1200, 500);
    sunLight.castShadow = true;
    scene.add(sunLight);
    ground = new THREE.Mesh(
        createTerrainGeometry(Number(sourceData.hillHeight) || 0),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.GridHelper(4100, 82, 0x5e8079, 0x91aaa4));
    const originAxes = new THREE.AxesHelper(120);
    originAxes.position.y = 1;
    scene.add(originAxes);

    resizeRenderer();
    bindViewportControls();
    window.addEventListener('resize', resizeRenderer);
    if (window.ResizeObserver) new ResizeObserver(resizeRenderer).observe(mapViewport);
    setGroundTexture(document.getElementById('textureSelect').value);
    editorStatus.textContent = '';
    await Promise.all(objects.map((object, index) => createObjectRoot(object, index)));
    renderObjectList();
    selectObject(-1);
    animate();
}

window.addEventListener('beforeunload', () => cancelAnimationFrame(animationFrame));
initMapEditor().catch(error => {
    console.error('Unable to initialize the map editor:', error);
    viewportMessage.textContent = error.message;
    viewportMessage.hidden = false;
});