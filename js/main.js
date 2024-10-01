import * as THREE from 'three';

import { MTLLoader } from './libs/MTLLoader.js';
import { GLTFLoader } from './libs/GLTFLoader.js';
import { DDSLoader } from './libs/DDSLoader.js';
import { OBJLoader } from './libs/OBJLoader.js';
import { STLLoader } from './libs/STLLoader.js';

let container, camera, scene, renderer;
// создание загрузчика текстур
let loader = new THREE.TextureLoader();
let clock = new THREE.Clock();
// загрузка текстуры grasstile.jpg из папки images
let tex = loader.load('./images/grasstile.jpg');
let N = 255;
let geometry;

// глобальные переменные для хранения списка анимаций
let mixer;
let morphs = [];

let cursor, circle;
let radius = 10;
let bD = 0;

// экранные координаты курсора мыши
let mouse = { x: 0, y: 0 }; 
// массив для объектов, проверяемых на пересечение с курсором
let targetList = [];    

// объект интерфейса и его ширина  
let gui = new dat.GUI();
gui.width = 200;
let brVal = false; //стоит ли галочка

let rotationSX;
let rotationSY;
let rotationSZ;

let scaleSX;
let scaleSY;
let scaleSZ;

let loadModels = [
    ['./models/house/', 'Cyprys_House.obj', 'Cyprys_House.mtl', 10, 'hous', false],
    ['./models/fence/', 'grade.obj', 'grade.mtl', 5, 'grade', false],
    ['../models/bushes/fern/', '10443_Fern_v2_max2011_it2.obj', '10443_Fern_v2_max2011_it2.mtl', 0.3, 'fern', true],
    ['../models/trees/cactus/', '10436_Cactus_v1_max2010_it2.obj', '10436_Cactus_v1_max2010_it2.mtl', 0.2, 'cactus', true],
    ['../models/trees/pine/', '10447_Pine_Tree_v1_L3b.obj', '10447_Pine_Tree_v1_L3b.mtl', 0.1, 'pine', true]
];

let loadAnimModels = [
    ['./models/animals/Parrot.glb', 0.2, 'parrot'],
    ['./models/animals/Flamingo.glb', 0.2, 'flamingo']
];

let guiModelsAdd = [
    ['addHouse', 'Добавить дом'],
    ['addGrade', 'Добавить ограду'],
    ['addFern', 'Добавить куст'],
    ['addCactus', 'Добавить кактус'],
    ['addPine', 'Добавить ель'],
    ['addParrot', 'Добавить птицу'],
    ['addFlamingo', 'Добавить фламинго']
];

let models = new Map;
let modelsOnScene = [];
let mixersOnScene = [];

let selected, press;
let ID = 0;

init();

animate();

//считает сколько раз процент загрузки был равен 100, чтобы вывести alert
let count = 0;
//ниже всё по загрузке и удалению моделей (часть 1)
function loadModel(path, objName, mtlName, s, name, rotation)
{
    // функция, выполняемая в процессе загрузки модели (выводит процент загрузки)
    let onProgress = function(xhr) {
        if (xhr.lengthComputable) {
            let percentComplete = Math.round(xhr.loaded / xhr.total * 100, 2); //xhr.loaded / xhr.total * 100;
            console.log(percentComplete + '% downloaded' );
            if (percentComplete == 100) count++;
            if (count == loadModels.length) al();
        }
    };
    // функция, выполняющая обработку ошибок, возникших в процессе загрузки
    let onError = function(xhr) { };

    const manager = new THREE.LoadingManager();

    new MTLLoader( manager )
        .setPath( path )
        .load ( mtlName, function( materials ){
            new OBJLoader( manager )
            .setMaterials( materials )
            .setPath( path )
            .load( objName, function( object ){
                if (rotation == true)
                object.rotation.x = - Math.PI / 2;
                object.scale.set( s, s, s);

                object.traverse(function( child ){
                    if ( child instanceof THREE.Mesh){
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.parent = object;
                    }
                });

                object.name = name;

                models.set(name, object);
                //scene.add( object );
        }, onProgress, onError);
    });
}

function getHeightAboveTexture(mesh) {
    // Создаем Box3 для получения границ модели
    let box = new THREE.Box3().setFromObject(mesh);
    let center = new THREE.Vector3();
    box.getCenter(center);

    // Определяем, какие координаты (x, z) будут использоваться для получения высоты
    let x = Math.round(center.x);
    let z = Math.round(center.z);

    // Получаем высоту текстуры в точке (x, z)
    let height = 0; // Здесь вы должны получить высоту над текстурой (например, из геометрии ландшафта)
    if (x >= 0 && x < N && z >= 0 && z < N) {
        let i1 = ((x * N) + z) * 3 + 1; // Индекс Y
        height = geometry.attributes.position.array[i1]; // Получаем Y-координату
    }

    // Возвращаем высоту с небольшим смещением, чтобы модель не пересекалась с текстурой
    return height + 50; // смещение, чтобы модель находилась над текстурой
}


function loadAnimatedModel(path, s) {
    const loader = new GLTFLoader(); // Создаем загрузчик GLTF

    loader.load(path, function (gltf) {
        const mesh = gltf.scene; // Используйте gltf.scene, чтобы получить всю сцену, а не только первый дочерний элемент
        const clip = gltf.animations[0]; // Получаем первую анимацию

        // Проверка, есть ли анимация
        if (clip) {
            const mixer = new THREE.AnimationMixer(mesh); // Создаем микшер анимации
            mixer.clipAction(clip).setDuration(1).startAt(0).play(); // Запускаем анимацию
            mixersOnScene.push(mixer); // Сохраняем микшер для обновления в анимационном цикле
        } else {
            console.warn("Анимация не найдена в модели:", path); // Предупреждение, если анимация отсутствует
        }

        // Установка размеров и позиции модели
        mesh.scale.set(s, s, s);
        mesh.position.y = getHeightAboveTexture(mesh)+50; // Вычисляем правильную высоту
        mesh.position.x = getRandomNumber(0, N); // Позиция по оси X
        mesh.position.z = getRandomNumber(0, N); // Позиция по оси Z
        mesh.rotation.y = Math.PI / getRandomNumber(1, 360); // Вращение

        // Включаем тени
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Инициализация userData.ID для идентификации
        mesh.userData.ID = ID;
        mesh.userData.isAnimated = true; // Устанавливаем свойство для анимированной модели
        // Создание куба, который будет служить для визуализации границ модели
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
        const cube = new THREE.Mesh(geometry, material);
        cube.material.visible = false; // Скрываем материал куба

        // Добавляем куб в сцену
        scene.add(cube);

        // Создаем коробку для определения границ модели
        const box = new THREE.Box3().setFromObject(mesh); // Устанавливаем размеры коробки в соответствии с моделью

        const pos = new THREE.Vector3();
        box.getCenter(pos); // Получаем центр коробки
        const size = new THREE.Vector3();
        box.getSize(size); // Получаем размеры коробки

        // Устанавливаем позицию и размеры куба в соответствии с моделью
        cube.position.copy(pos);
        cube.scale.set(size.x, size.y, size.z);

        // Сохраняем информацию в userData
        mesh.userData.cube = cube; // Ссылка на куб в userData
        cube.userData.n = mesh; // Ссылка на модель в userData

        // Добавляем модель в сцену
        scene.add(mesh);
        modelsOnScene.push(mesh); // Сохраняем модель в массиве
        ID++; // Увеличиваем ID для следующей модели

    }, 
    function (xhr) {
        // Отслеживание прогресса загрузки
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        console.log(`${Math.round(percentComplete)}% загружено`);
    }, 
    function (error) {
        // Обработка ошибок загрузки
        console.error('Ошибка загрузки модели:', error);
    });
}


function al()
{
    alert ("Все модели загружены и готовы к работе.");
}

function addMesh(name) {
    let originalModel = models.get(name);

    if (!originalModel) {
        console.error(`Model with name "${name}" not found in models.`);
        return; // Прекращаем выполнение, если модель не найдена
    }

    let n = originalModel.clone();
    n.position.y = 0;
    n.position.x = getRandomNumber(0, N);
    n.position.z = getRandomNumber(0, N);

    let box = new THREE.Box3();
    box.setFromObject(n);

    n.userData.box = box;

    const geometry = new THREE.BoxGeometry(1, 1, 1); 
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const cube = new THREE.Mesh(geometry, material); 
    scene.add(cube);

    cube.material.visible = false;

    let pos = new THREE.Vector3();
    box.getCenter(pos);
    let size = new THREE.Vector3();
    box.getSize(size);

    cube.position.copy(pos);
    cube.scale.set(size.x, size.y, size.z);

    n.userData.cube = cube;
    cube.userData.n = n;
    n.userData.ID = ID;

    scene.add(n);
    modelsOnScene.push(n);

    ID++;
}


function delMesh()
{
    if (selected != null)
    {
        for (let i = 0; i < modelsOnScene.length; i++)
        {
            if ( modelsOnScene[i].userData.ID == selected.userData.ID ) 
            {
                selected.userData.cube.material.visible = false;

                delete modelsOnScene[i].userData.cube;
                scene.remove(modelsOnScene[i]);
                selected = null;
                break;
            }
        }
    }
}

function getRandomNumber(min, max) {
    return Math.random() * (max - min) + min
}

//ниже всё по созданию ландшафта (часть 2)
function addCursor()
{
    // параметры цилиндра: диаметр вершины, диаметр основания, высота, число сегментов
    let cylinderGeometry = new THREE.CylinderGeometry(1.5, 0, 5, 64);
    let cylinderMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
    cursor = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cursor.visible = false;
    scene.add(cursor);
}

function addCircle()
{
    let segments = 64;

    let vertices = [];

    for (let i = 0; i <= segments; i++) {
        let theta = (i / segments) * Math.PI * 2;
        vertices.push(new THREE.Vector3(
            Math.cos(theta) * 1,   0.0,   Math.sin(theta) * 1));
    }
        
    // параметры: цвет, размер черты, размер промежутка
    const material = new THREE.LineBasicMaterial( {
        color: 0xffff00,
        linewidth: 1
    } );

    let lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    circle = new THREE.Line(lineGeometry, material);
    circle.scale.set(radius, 1, radius);
    circle.visible = false;
    scene.add(circle);
}

function onDocumentMouseScroll(event) 
{
    if (radius > 2)
        if (event.wheelDelta< 0) 
            radius -= 2;
    if (radius < 35)
        if (event.wheelDelta > 0) 
            radius += 2;
    circle.scale.set(radius, 1, radius);
}

function onDocumentMouseMove(event) 
{ 
    // получение экранных координат курсора мыши и приведение их к трёхмерным
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // создание луча, исходящего из позиции камеры и проходящего сквозь позицию курсора мыши
    let vector = new THREE.Vector3(mouse.x, mouse.y, 1);
    vector.unproject(camera);

    let ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

    // создание массива для хранения объектов, с которыми пересечётся луч 
    let intersects = ray.intersectObjects(targetList);

    if (brVal === true && selected === null)
    {
        // если луч пересёк какой-либо объект из списка targetList 
        if (intersects.length > 0)
        {
            if (cursor != null) 
            {
                cursor.position.copy(intersects[0].point);
                cursor.position.y += 2.5; // Позиция курсора
            }
            if (circle != null) 
            {
                circle.position.copy(intersects[0].point);
                circle.position.y = 0;

                // Убедитесь, что circle.geometry.attributes.position.array инициализирован
                const positions = circle.geometry.attributes.position.array;
                if (positions && positions.length > 0) {
                    for (let i = 0; i < positions.length / 3; i++)
                    {
                        // получение позиции в локальной системе координат
                        let pos = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                        // нахождение позиции в глобальной системе координат
                        pos.applyMatrix4(circle.matrixWorld);

                        let x = Math.round(pos.x);
                        let z = Math.round(pos.z);

                        if (x > 0 && x < N && z > 0 && z < N)
                        {
                            let i1 = ((x * N) + z) * 3 + 1;
                            let y = geometry.attributes.position.array[i1];

                            positions[i * 3 + 1] = y + 0.01; // Обновляем координату Y
                        } else {
                            positions[i * 3 + 1] = 0; // Обнуляем Y
                        }
                    }
                    circle.geometry.attributes.position.needsUpdate = true; // Уведомляем Three.js о том, что атрибуты изменились
                }
            }
        }
    } else {
        if (intersects.length > 0 && selected !== null && press != null) {
            // Перемещение объекта press
            let intersectionPoint = intersects[0].point.clone(); // Получаем точку пересечения

            // Устанавливаем позицию по X и Z из точки пересечения
            press.position.x = intersectionPoint.x;
            press.position.z = intersectionPoint.z;

            // Проверяем, является ли модель анимированной
            if (press.userData && press.userData.isAnimated) {
                // Для анимированных моделей добавляем высоту над текстурой
                let heightAboveTexture = getHeightAboveTexture(press);
                press.position.y = heightAboveTexture; // Устанавливаем высоту для анимированной модели
            } else {
                // Для обычных моделей устанавливаем высоту равной Y координате пересечения
                press.position.y = intersectionPoint.y; // Устанавливаем высоту для обычной модели
            }

            // Обновляем cube позиции
            if (press.userData && press.userData.box) {
                press.userData.box.setFromObject(press);

                let pos = new THREE.Vector3();
                press.userData.box.getCenter(pos);

                if (press.userData.cube) {
                    press.userData.cube.position.copy(pos);
                }
            } else {
                console.error("userData или box не определены для объекта press");
            }
        }
    }
}


function onDocumentMouseDown(event) { 
    if (brVal) {
        if (event.which == 1) bD = 1;
        if (event.which == 3) bD = -1;
    } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        let vector = new THREE.Vector3(mouse.x, mouse.y, 1);
        vector.unproject(camera);

        let ray = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
        let intersects = ray.intersectObjects(modelsOnScene, true);

        if (intersects.length > 0) {
            let s = intersects[0].object.parent;
            if (selected != null) {
                if (s == selected) {
                    if (selected && selected.userData && selected.userData.cube && selected.userData.cube.material) {
                        selected.userData.cube.material.visible = false;
                    }
                    selected = null;
                    press = null;
                } else {
                    if (selected && selected.userData && selected.userData.cube && selected.userData.cube.material) {
                        selected.userData.cube.material.visible = false;
                    }
                    selected = s;
                    if (selected && selected.userData && selected.userData.cube && selected.userData.cube.material) {
                        selected.userData.cube.material.visible = true;
                    }
                    press = selected;
                }
            } else {
                selected = intersects[0].object.parent;
                if (selected && selected.userData && selected.userData.cube && selected.userData.cube.material) {
                    selected.userData.cube.material.visible = true;
                }
                press = selected;
            }
        } else if (selected != null && selected.userData.pl == undefined) {
            if (selected && selected.userData && selected.userData.cube && selected.userData.cube.material) {
                selected.userData.cube.material.visible = false;
            }
            selected = null;
            press = null;
        }
        
        // Проверка press на наличие userData и box
        if (press) {
            if (!press.userData) {
                press.userData = {}; // Инициализируем userData
            }
            if (!press.userData.box) {
                press.userData.box = new THREE.Box3(); // Инициализируем box
            }
        }
    }
}


function onDocumentMouseUp(event) 
{ 
    if (brVal) bD = 0;
    press = null;
}

function create_relief()
{
    if (brVal == true)
    {
        for (let i = 0; i < geometry.attributes.position.array.length / 3; i++)
        {
            let x2 = geometry.attributes.position.array[i*3]; //x
            let z2 = geometry.attributes.position.array[i*3+2]; //z
            let r = radius;
            let x1 = cursor.position.x;
            let z1 = cursor.position.z;

            let h = r * r - (((x2 - x1) * (x2 - x1)) + ((z2 - z1) * (z2 - z1)));

            if (h > 0) 
            {
                geometry.attributes.position.array[i*3+1] += Math.sqrt(h) * bD / 20; //y
            }
        }
        
        geometry.computeVertexNormals(); //пересчёт нормалей      
        geometry.attributes.position.needsUpdate = true; //обновление вершин
        geometry.attributes.normal.needsUpdate = true; //обновление нормалей
        geometry.attributes.uv.needsUpdate = true;
    }
}

//ниже всё по интерфейсу (часть 3)
function GUI()
{
    // массив переменных, ассоциированных с интерфейсом  
    let params = 
    {
        sx: 0,
        sy: 0,
        sz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        brush: false,
        addHouse: function() { addMesh('hous') },
        addGrade: function() { addMesh('grade') },
        addCactus: function() { addMesh('cactus') },
        addPine: function() { addMesh('pine') },
        addFern: function() { addMesh('fern') },
        addParrot: function() { loadAnimatedModel('./models/animals/Parrot.glb', 0.2)},
        addFlamingo: function() { loadAnimatedModel('./models/animals/Flamingo.glb', 0.2)},
        delete: function() { delMesh() }
    };

    // создание вкладки
    let folder1 = gui.addFolder('Размер');
    scaleSX = folder1.add(params, 'sx').min(0).max(100).step(1).listen();
    scaleSY = folder1.add(params, 'sy').min(0).max(100).step(1).listen();
    scaleSZ = folder1.add(params, 'sz').min(0).max(100).step(1).listen();
    // при запуске программы папка будет открыта
    folder1.open();

    // описание действий совершаемых при изменении ассоциированных значений  
    scaleSX.onChange(function(value) {
        let lastScaleValue = selected.scale.x;
        let r = value; 
        value = value - lastScaleValue;
        lastScaleValue = r;
        selected.scale.x += value;
    
        selected.userData.box.setFromObject(selected);
        
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);
    
        let size = new THREE.Vector3();
        selected.userData.box.getSize(size);
    
        selected.userData.cube.scale.set(size.x, size.y, size.z);
     });
    scaleSY.onChange(function(value) {
        let lastScaleValue = selected.scale.y;
        let r = value; 
        value = value - lastScaleValue;
        lastScaleValue = r;
        selected.scale.y += value;

        selected.userData.box.setFromObject(selected);
        
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);

        let size = new THREE.Vector3();
        selected.userData.box.getSize(size);

        selected.userData.cube.scale.set(size.x, size.y, size.z);
     });
    scaleSZ.onChange(function(value) {
        let lastScaleValue = selected.scale.z;
        let r = value; 
        value = value - lastScaleValue;
        lastScaleValue = r;
        selected.scale.z += value;

        selected.userData.box.setFromObject(selected);
        
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);

        let size = new THREE.Vector3();
        selected.userData.box.getSize(size);

        selected.userData.cube.scale.set(size.x, size.y, size.z);
     });

    // создание вкладки
    let folder2 = gui.addFolder('Позиция');
    rotationSX = folder2.add(params, 'rx').min(0).max(359).step(1).listen();
    rotationSY = folder2.add(params, 'ry').min(0).max(359).step(1).listen();
    rotationSZ = folder2.add(params, 'rz').min(0).max(359).step(1).listen();
    folder2.open();

    let lastRotValueX = 0;
    let lastRotValueY = 0;
    let lastRotValueZ = 0;

    rotationSX.onChange(function(value) {
        let r = value;
        value = value - lastRotValueX;
        lastRotValueX = r;
        selected.rotation.x += value * (Math.PI / 180);

        selected.userData.box.setFromObject(selected);
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);

        selected.userData.cube.rotation.x = selected.rotation._x;
     });
    rotationSY.onChange(function(value) {
        let r = value;
        value = value - lastRotValueY;
        lastRotValueY = r;
        selected.rotation.y += value * (Math.PI / 180);

        selected.userData.box.setFromObject(selected);
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);

        selected.userData.cube.rotation.y = selected.rotation._y;
     });
    rotationSZ.onChange(function(value) {
        let r = value;
        value = value - lastRotValueZ;
        lastRotValueZ = r;
        selected.rotation.z += value * (Math.PI / 180);

        selected.userData.box.setFromObject(selected);
        let pos = new THREE.Vector3();
        selected.userData.box.getCenter(pos);
        selected.userData.cube.position.copy(pos);

        selected.userData.cube.rotation.z = selected.rotation._z;
     });

    // добавление кнопок, при нажатии которых будут вызываться функции addHouse
    folder2 = gui.addFolder('Добавить');
    for (let i = 0; i < guiModelsAdd.length; i++)
    {
        folder2.add(params, guiModelsAdd[i][0]).name(guiModelsAdd[i][1])
    }
    folder2.open();

    gui.add(params, 'delete').name("Удалить");

    // добавление чекбокса с именем brush
    let brushVisible = gui.add(params, 'brush').name('Рельеф').listen();
    brushVisible.onChange(function(value) 
    { 
        if (selected != null)
        {
            selected.userData.cube.material.visible = false;
            selected = null;
            press = null;
        }

        brVal = value;
        cursor.visible = value;
        circle.visible = value;
    });
        
    // при запуске программы интерфейс будет раскрыт
    gui.open();

}

//ниже всё по созданию сцены (небо, камера и тд) (часть 0)
function init() 
{
    console.log('init');
    // получение ссылки на блок html-страницы
    container = document.getElementById('container');
    // создание сцены
    scene = new THREE.Scene();

    // КАМЕРА
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);    
    camera.position.set(N/2, N, N * 1.4);
    camera.lookAt(new THREE.Vector3(N/2, 0, N/2));  

    // РЕНДЕРЕР
    renderer = new THREE.WebGLRenderer( { antialias: false } );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x87CEEB, 1);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    // добавление обработчика события изменения размеров окна
    window.addEventListener('resize', onWindowResize, false);

    // СВЕТ
    let spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.set(N, N, N);

    spotlight.shadow.mapSize.width = 512;
    spotlight.shadow.mapSize.height = 512;
    spotlight.shadow.camera.near = 0.5;
    spotlight.shadow.camera.far = 5000;

    spotlight.castShadow = true; 

    // добавление источника в сцену
    scene.add(spotlight);
    scene.add(new THREE.AmbientLight(0xFDFCEB, 0.5)  );


    renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onDocumentMouseUp, false);
    renderer.domElement.addEventListener('mousemove', onDocumentMouseMove, false);
    renderer.domElement.addEventListener('wheel', onDocumentMouseScroll, false);
    renderer.domElement.addEventListener("contextmenu", function (event) {event.preventDefault();});

    addPlane();
    create_sky("./images/fantastic-cloudscape.jpg", 2000);

    addCursor();
    addCircle();

    for (let i = 0; i < loadModels.length; i ++)
    {
        loadModel(loadModels[i][0], loadModels[i][1], loadModels[i][2], loadModels[i][3], loadModels[i][4], loadModels[i][5]);
    }

    for (let j = 0; j < loadAnimModels.length; j ++)
    {
        loadAnimatedModel(loadAnimModels[j][0], loadAnimModels[j][1], loadAnimModels[j][2]);
    }

    GUI();
}

function onWindowResize() 
{
    // изменение соотношения сторон для виртуальной камеры
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // изменение соотношения сторон рендера
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() 
{
    requestAnimationFrame(animate);

    if (mixersOnScene.length > 0)
    {
        let delta = clock.getDelta();
        for (let i = 0; i < mixersOnScene.length; i++)
        {
            if(mixersOnScene[i]) mixersOnScene[i].update(delta);
        }
    }

    if (bD != 0) create_relief();

    render();   
}

function render() 
{
    // рисование кадра
    renderer.render(scene, camera);
}

//создание плоскости
function addPlane()
{
    let vertices = []; //массив вершин
    let faces = []; //массив индексов
    let uvs = []; //массив текстурных карт

    geometry = new THREE.BufferGeometry();

    for (let y = 0; y < N; y++)
    for (let u = 0; u < N; u++)
    {
        vertices.push(y, 0, u);
        uvs.push(y/(N-1), u/(N-1));
    }

    for (let y = 0; y < N - 1; y++)
    for (let u = 0; u < N - 1; u++)
    {
        faces.push(y + u * N, (y + 1) + u * N, (y + 1) + (u + 1) * N);
        faces.push(y + u * N, (y + 1) + (u + 1) * N, y + (u + 1) * N);
    }

    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ));
    geometry.setIndex( faces );
    geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ));

    geometry.computeVertexNormals();

    // режим повторения текстуры
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; 
    // повторить текстуру 10 на 10 раз
    tex.repeat.set(3, 3);

    let material = new THREE.MeshLambertMaterial({
        map: tex,
        wireframe: false,
        side: THREE.DoubleSide
    });

    let plane = new THREE.Mesh(geometry, material);
    plane.position.set(0.0, 0.0, 0.0);

    plane.receiveShadow = true;
    //plane.castShadow = true; 

    //чтобы не возникало ошибки, когда программа думает что сфера относится к загруженным объектам
    plane.userData.pl = null;

    // добавление плоскости (ландшафта) в массив
    targetList.push(plane);

    // добавление объекта в сцену     
    scene.add(plane);
}

//создание неба
function create_sky(texture, rad)
{
    // создание геометрии для сферы
    let sGeometry = new THREE.SphereGeometry(rad, 50, 50);

    // загрузка текстуры
    let tex = loader.load(texture);
    tex.minFilter = THREE.NearestFilter;

    // создание материала
    let material = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide
    });
    
    // создание объекта
    let sphere = new THREE.Mesh(sGeometry, material);

    sphere.position.set(0, 0, 0);

    //чтобы не возникало ошибки, когда программа думает что сфера относится к загруженным объектам
    sphere.userData.pl = null;
    
    // размещение объекта в сцене
    scene.add(sphere);
}