// core/InputController.js
export class InputController {
    constructor(domElement) {
        this.domElement = domElement;

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false,
            space: false,
        };

        this.mouseButtons = {
            left: false,
            right: false,
        };

        this.mouseDelta = { x: 0, y: 0 };
        this.yaw = 0;
        this.pitch = 0;
        this.mouseSensitivity = 0.002;

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
    }

    update() {
        // 마우스 회전 누적
        this.yaw   -= this.mouseDelta.x * this.mouseSensitivity;
        this.pitch -= this.mouseDelta.y * this.mouseSensitivity;

        // 상하 회전 제한 (-90도 ~ 90도)
        this.pitch = Math.max(-Math.PI / 3, Math.min(0, this.pitch));

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
