// core/InputController.js
export class InputController {
    constructor(domElement, DEBUG_MODE = false) {
        this.domElement = domElement;
        this.debugMode = DEBUG_MODE;

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false,
            space: false,
        };

        // 🔹 한 번만 소비하는 키 입력들 (포션 같은 것)
        this.keyPresses = new Set();

        this.mouseButtons = {
            left: false,
            right: false,
        };

        this.mouseDelta = { x: 0, y: 0 };
        this.yaw = 0;
        this.pitch = 0;
        this.mouseSensitivity = 0.002;

        this.cameraLocked = true;

        this._bindEvents();
    }

    _bindEvents() {
        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                this.mouseDelta.x = e.movementX;
                this.mouseDelta.y = e.movementY;
            }
        });

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = true;
            if (e.key === 'Shift') this.keys.shift = true;
            if (e.code === 'Space') this.keys.space = true;

            // 🔹 포션: 1번 키 "누른 순간"만 기록
            if (e.key === '1') {
                this.keyPresses.add('1');   // Game이 이걸 보고 usePotion() 호출
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) this.keys[key] = false;
            if (e.key === 'Shift') this.keys.shift = false;
            if (e.code === 'Space') this.keys.space = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseButtons.left = true;
            if (e.button === 2) this.mouseButtons.right = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseButtons.left = false;
            if (e.button === 2) this.mouseButtons.right = false;
        });

        // 마우스 오른쪽 클릭 메뉴 비활성화
        this.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 디버그모드면 카메라 제한 해제 가능
        if (this.debugMode) {
            window.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'c') {
                    this.cameraLocked = !this.cameraLocked;
                }
            });
        }
    }

    update() {
        // 마우스 회전 누적
        this.yaw   -= this.mouseDelta.x * this.mouseSensitivity;
        this.pitch -= this.mouseDelta.y * this.mouseSensitivity;

        // 상하 회전 제한 (-90도 ~ 90도)
        // 디버그모드가 아닌 일반적인 경우 cameraLocked는 항상 true
        if (this.cameraLocked) {
            this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 6, this.pitch));
        }

        // 한 프레임마다 delta는 초기화해줘야 다음 프레임에서 “변화량”만 반영됨
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }

    applyToCamera(camera) {
        // 카메라 회전 적용
        camera.rotation.order = 'YXZ';
        camera.rotation.y = this.yaw;
        camera.rotation.x = this.pitch;
    }

}
