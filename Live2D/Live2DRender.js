/*
 * Live2D描画クラス
 */
THREE.Live2DRender = function(renderer, filepath, filenm, scale) {
    // WebGL ContextのWebGLRenderer
    if(renderer){
        this.gl = renderer.getContext();
    }else{
        console.error("第1引数にrendererを渡して下さい");
        return;
    }
    // モデルファイルパス
    if(filepath){
        this.filepath = filepath;
    }else{
        console.error("第2引数にFilePathを渡して下さい");
        return;
    }
    // Jsonファイル名
    if(filenm){
        this.filenm = filenm;
    }else{
        console.error("第3引数にファイル名を渡して下さい");
        return;
    }
    // Live2DモデルWebGL表示サイズ
    this.modelscale = scale || 2.0;

    // Live2Dモデルのインスタンス
    this.live2DModel = null;
    // モデルのロードが完了したら true
    this.loadLive2DCompleted = false;
    // モデルの初期化が完了したら true
    this.initLive2DCompleted = false;
    // WebGL Image型オブジェクトの配列
    this.loadedImages = [];
    // モーション
    this.motions = [];
    // モーション管理マネジャー
    this.motionMgr = null;
    // モーション番号
    this.motionnm = 0;
    // モーションフラグ
    this.motionflg = false;
    // サウンド
    this.sounds = [];
    // サウンド番号
    this.soundnm = 0;
    // 前に流したサウンド
    this.beforesound = 0;
    // 表情モーション
    this.expressions = [];
    // 表情モーション名
    this.expressionsnm = [];
    // 表情モーション管理マネジャー
    this.expressionManager = null;
    // 表情モーションフラグ
    this.expressionflg = false;
    // 表情モーション番号
    this.expressionnm = 0;
    // Live2Dモデル設定
    this.modelDef = null;
    // フェードイン
    this.fadeines = [];
    // フェードアウト
    this.fadeoutes = [];
    // ポーズ
    this.pose = null;
    // 物理演算
    this.physics = null;
    // ドラッグによるアニメーション管理
    this.dragMgr = null;        /*new L2DTargetPoint();*/
    this.viewMatrix = null;     /*new L2DViewMatrix();*/
    this.projMatrix = null;     /*new L2DMatrix44()*/
    this.deviceToScreen = null; /*new L2DMatrix44();*/
    this.drag = false;          // ドラッグ中かどうか
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.dragX      = 0;
    this.dragY      = 0;

    // Live2Dの初期化
    Live2D.init();
    // OpenGLのコンテキストをセット
    Live2D.setGL(this.gl);
    // Live2Dモデル管理クラスのインスタンス化
    this.live2DMgr = new LAppLive2DManager();
    // Jsonをロード(modelDefをセット)
    this.loadJson();
    // マウスドラッグの座標設定
    this.setMouseView(renderer);

    // マウスドラッグのイベントリスナー
    document.addEventListener("mousedown", this.mouseEvent.bind(this), false);
    document.addEventListener("mousemove", this.mouseEvent.bind(this), false);
    document.addEventListener("mouseup", this.mouseEvent.bind(this), false);
    document.addEventListener("mouseout", this.mouseEvent.bind(this), false);
};

/*
 * Live2D描画クラスのファンクション
 */
THREE.Live2DRender.prototype = {

    /**
    * WebGLコンテキストを取得・初期化。
    * Live2Dの初期化、描画ループを開始。
    */
    initLoop : function()
    {
        //------------ Live2Dの初期化 ------------
        // コールバック対策用
        var that = this;
        // mocファイルからLive2Dモデルのインスタンスを生成
        this.loadBytes(that.filepath + that.modelDef.model, function(buf){
            that.live2DModel = Live2DModelWebGL.loadModel(buf);
        });

        /********** テクスチャの読み込み **********/
        var loadCount = 0;
        for(var i = 0; i < that.modelDef.textures.length; i++){
            (function ( tno ){// 即時関数で i の値を tno に固定する（onerror用)
                that.loadedImages[tno] = new Image();
                that.loadedImages[tno].src = that.filepath + that.modelDef.textures[tno];
                that.loadedImages[tno].onload = function(){
                    if((++loadCount) == that.modelDef.textures.length) {
                        that.loadLive2DCompleted = true;//全て読み終わった
                    }
                }
                that.loadedImages[tno].onerror = function() {
                    console.log("Failed to load image : " + that.modelDef.textures[tno]);
                }
            })( i );
        }

        /********** モーションの読み込み **********/
        var motion_keys = [];   // モーションキー配列
        var mtn_tag = 0;        // モーションタグ
        var mtn_num = 0;        // モーションカウント
        // keyを取得
        for(var key in that.modelDef.motions){
            // moitons配下のキーを取得
            motion_keys[mtn_tag] = key;
            // 読み込むモーションファイル数を取得
            mtn_num += that.modelDef.motions[motion_keys[mtn_tag]].length;
            mtn_tag++;
        }
        // モーションタグ分ループ
        for(var mtnkey in motion_keys){
            // モーションとサウンドを読み込む(motions配下のタグを読み込む)
            for(var j = 0; j < that.modelDef.motions[motion_keys[mtnkey]].length; j++){
                // モーションの数だけロード
                that.loadBytes(that.filepath + that.modelDef.motions[motion_keys[mtnkey]][j].file, function(buf){
                    that.motions.push(Live2DMotion.loadMotion(buf));
                });
                // サウンドの数だけロード
                if(that.modelDef.motions[motion_keys[mtnkey]][j].sound == null){
                    that.sounds.push("");
                }else{
                    that.sounds.push(new L2DSound(that.filepath + that.modelDef.motions[motion_keys[mtnkey]][j].sound));
                }
                // フェードイン
                if(that.modelDef.motions[motion_keys[mtnkey]][j].fade_in == null){
                    that.fadeines.push("");
                }else{
                    that.fadeines.push(that.modelDef.motions[motion_keys[mtnkey]][j].fade_in);
                }
                // フェードアウト
                if(that.modelDef.motions[motion_keys[mtnkey]][j].fade_out == null){
                    that.fadeoutes.push("");
                }else{
                    that.fadeoutes.push(that.modelDef.motions[motion_keys[mtnkey]][j].fade_out);
                }
            }
        }
        // モーションマネジャーのインスタンス化
        that.motionMgr = new L2DMotionManager();

        /********** 表情モーションの読み込み **********/
        var expression_name = [];   // 表情モーション名の配列
        var expression_file = [];   // 表情モーションファイル名の配列

        // 表情のロード(json内にexpressionsがあるかチェック)
        if(that.modelDef.expressions !== void 0){
            for(var i = 0; i < that.modelDef.expressions.length; i++){
                // 表情モーション名の配列を取得
                expression_name[i] = that.modelDef.expressions[i].name;
                expression_file[i] = that.filepath + that.modelDef.expressions[i].file;
                // 表情ファイルをロード
                that.loadExpression(expression_name[i], expression_file[i]);
            }
        }
        // 表情モーションマネージャーのインスタンス化
        that.expressionManager = new L2DMotionManager();

        // ポーズのロード(json内のposeがあるかチェック)
        if(that.modelDef.pose !== void 0){
            that.loadBytes(that.filepath + that.modelDef.pose, function(buf){
                // ポースクラスのロード
                that.pose = L2DPose.load(buf);
            });
        }

        // 物理演算のロード(json内のphysicsがあるかチェック)
        if(that.modelDef.physics !== void 0){
            that.loadBytes(that.filepath + that.modelDef.physics, function(buf){
                // 物理演算クラスのロード
                that.physics = L2DPhysics.load(buf);
            });
        }
    },

    /**
     * Live2Dのドラッグ座標軸
     */
    setMouseView : function(renderer){
        // 3Dバッファの初期化
        var width  = renderer.getSize().width;
        var height = renderer.getSize().height;
        // ビュー行列
        var ratio  = height / width;
        var left   = -1.0;
        var right  =  1.0;
        var bottom = -ratio;
        var top    = ratio;

        // ドラッグ用のクラス
        this.dragMgr = new L2DTargetPoint();
        // Live2DのView座標クラス
        this.viewMatrix = new L2DViewMatrix();

        // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
        this.viewMatrix.setScreenRect(left, right, bottom, top);
        // デバイスに対応する画面の範囲。 Xの左端, Xの右端, Yの下端, Yの上端
        this.viewMatrix.setMaxScreenRect(-2.0, 2.0, -2.0, 2.0);
        this.viewMatrix.setMaxScale(2.0);
        this.viewMatrix.setMinScale(0.8);

        // Live2Dの座標系クラス
        this.projMatrix = new L2DMatrix44();
        this.projMatrix.multScale(1, (width / height));

        // マウス用スクリーン変換行列
        this.deviceToScreen = new L2DMatrix44();
        this.deviceToScreen.multTranslate(-width / 2.0, -height / 2.0);
        this.deviceToScreen.multScale(2 / width, -2 / width);
    },

    /**
    * Live2Dの描画
    */
    draw : function()
    {
        // Live2D初期化
        if( ! this.live2DModel || ! this.loadLive2DCompleted )
            return; //ロードが完了していないので何もしないで返る

        // ロード完了後に初回のみ初期化する
        if( ! this.initLive2DCompleted ){
            this.initLive2DCompleted = true;

            // 画像からWebGLテクスチャを生成し、モデルに登録
            for( var i = 0; i < this.loadedImages.length; i++ ){
                //Image型オブジェクトからテクスチャを生成
                var texName = this.createTexture(this.gl, this.loadedImages[i]);

                this.live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
            }

            // テクスチャの元画像の参照をクリア
            this.loadedImages = null;

            // 表示位置を指定するための行列を定義する
            var s = this.modelscale / this.live2DModel.getCanvasWidth(); //canvasの横幅を-1..1区間に収める
            var matrix4x4 = [
                 s, 0, 0, 0,
                 0,-s, 0, 0,
                 0, 0, 1, 0,
                -this.modelscale/2, this.modelscale/2, 0, 1
            ];
            this.live2DModel.setMatrix(matrix4x4);
        }

        // アイドルモーション以外の場合（フラグと優先度で判定する）
        if(this.motionflg == true && this.motionMgr.getCurrentPriority() == 0){
            // フェードインの設定
            this.motions[this.motionnm].setFadeIn(this.fadeines[this.motionnm]);
            // フェードアウトの設定
            this.motions[this.motionnm].setFadeOut(this.fadeoutes[this.motionnm]);
            // アイドルモーションよりも優先度を高く再生する
            this.motionMgr.startMotion(this.motions[this.motionnm], 1);
            this.motionflg = false;
            // 音声ファイルもあれば再生
            if(this.sounds[this.motionnm]){
                // 前回の音声があれば停止する
                if(this.sounds[this.beforesound] != ""){
                    this.sounds[this.beforesound].stop();
                }
                // 音声を再生
                this.sounds[this.motionnm].play();
                // 途中で停止できるように格納する
                this.beforesound = this.motionnm;
            }
        }

        // モーションが終了していたらアイドルモーションの再生
        if(this.motionMgr.isFinished() && this.motionnm != null){
            // フェードインの設定
            this.motions[this.motionnm].setFadeIn(this.fadeines[this.motionnm]);
            // フェードアウトの設定
            this.motions[this.motionnm].setFadeOut(this.fadeoutes[this.motionnm]);
            // 優先度は低めでモーション再生
            this.motionMgr.startMotion(this.motions[this.motionnm], 0);
            // 音声ファイルもあれば再生
            if(this.sounds[this.motionnm]){
                // 前回の音声があれば停止する
                if(this.sounds[this.beforesound] != ""){
                    this.sounds[this.beforesound].stop();
                }
                // 音声を再生
                this.sounds[this.motionnm].play();
                // 途中で停止できるように格納する
                this.beforesound = this.motionnm;
            }
        }
        // モーション指定されていない場合は何も再生しない
        if(this.motionnm != null){
            // モーションパラメータの更新
            this.motionMgr.updateParam(this.live2DModel);
        }

        // 表情でパラメータ更新（相対変化）
        if(this.expressionManager != null &&
           this.expressions != null &&
           !this.expressionManager.isFinished())
        {
            this.expressionManager.updateParam(this.live2DModel);
        }
        // ポーズパラメータの更新
        if(this.pose != null)this.pose.updateParam(this.live2DModel);

        // 物理演算パラメータの更新
        if(this.physics != null)this.physics.updateParam(this.live2DModel);

        // ドラッグ用パラメータの更新
        this.dragMgr.update();
        this.dragX = this.dragMgr.getX();
        this.dragY = this.dragMgr.getY();
        this.live2DModel.setParamFloat("PARAM_ANGLE_X", this.dragX * 30);       // -30から30の値を加える
        this.live2DModel.setParamFloat("PARAM_ANGLE_Y", this.dragY * 30);
        // ドラッグによる体の向きの調整
        this.live2DModel.setParamFloat("PARAM_BODY_ANGLE_X", this.dragX*10);    // -10から10の値を加える
        // ドラッグによる目の向きの調整
        this.live2DModel.setParamFloat("PARAM_EYE_BALL_X", this.dragX);         // -1から1の値を加える
        this.live2DModel.setParamFloat("PARAM_EYE_BALL_Y", this.dragY);
        // キャラクターのパラメータを適当に更新
        var t = UtSystem.getTimeMSec() * 0.001 * 2 * Math.PI; //1秒ごとに2π(1周期)増える
        var cycle = 3.0; //パラメータが一周する時間(秒)
        // 呼吸する
        this.live2DModel.setParamFloat("PARAM_BREATH", 0.5 + 0.5 * Math.sin(t/cycle));

        // Live2Dモデルを更新して描画
        this.live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
        this.live2DModel.draw();    // 描画
    },

    /**
     * マウスイベント
     */
    mouseEvent : function(e)
    {
        // 右クリック制御
        e.preventDefault();
        // マウスダウン時
       if (e.type == "mousedown") {
           // 左クリック以外なら処理を抜ける
           if("button" in e && e.button != 0) return;
           this.modelTurnHead(e);

       // マウス移動時
       } else if (e.type == "mousemove") {
           this.followPointer(e);

       // マウスアップ時
       } else if (e.type == "mouseup") {
           // 左クリック以外なら処理を抜ける
           if("button" in e && e.button != 0) return;
           if (this.drag){
               this.drag = false;
           }
           this.dragMgr.setPoint(0, 0);

       // CANVAS外にマウスがいった時
       } else if (e.type == "mouseout") {
           if (this.drag)
           {
               this.drag = false;
           }
           this.dragMgr.setPoint(0, 0);
       }
    },

    /**
    * クリックされた方向を向く
    * タップされた場所に応じてモーションを再生
    */
    modelTurnHead : function(e)
    {
        this.drag = true;
        var rect = e.target.getBoundingClientRect();

        var sx = this.transformScreenX(e.clientX - rect.left);
        var sy = this.transformScreenY(e.clientY - rect.top);
        var vx = this.transformViewX(e.clientX - rect.left);
        var vy = this.transformViewY(e.clientY - rect.top);

        this.lastMouseX = sx;
        this.lastMouseY = sy;
        this.dragMgr.setPoint(vx, vy); // その方向を向く
    },

    /**
    * マウスを動かした時のイベント
    */
    followPointer : function(e)
    {
        var rect = e.target.getBoundingClientRect();
        var sx = this.transformScreenX(e.clientX - rect.left);
        var sy = this.transformScreenY(e.clientY - rect.top);
        var vx = this.transformViewX(e.clientX - rect.left);
        var vy = this.transformViewY(e.clientY - rect.top);

        if (this.drag)
        {
            this.lastMouseX = sx;
            this.lastMouseY = sy;
            this.dragMgr.setPoint(vx, vy); // その方向を向く
        }
    },

    /**
    * 論理座標変換したView座標X
    */
    transformViewX : function(deviceX)
    {
        var screenX = this.deviceToScreen.transformX(deviceX);  // 論理座標変換した座標を取得。
        return this.viewMatrix.invertTransformX(screenX);       // 拡大、縮小、移動後の値。
    },

    /**
    * 論理座標変換したView座標Y
    */
    transformViewY : function(deviceY)
    {
        var screenY = this.deviceToScreen.transformY(deviceY);  // 論理座標変換した座標を取得。
        return this.viewMatrix.invertTransformY(screenY);       // 拡大、縮小、移動後の値。
    },

    /**
    * 論理座標変換したScreen座標X
    */
    transformScreenX : function(deviceX)
    {
        return this.deviceToScreen.transformX(deviceX);
    },

    /**
    * 論理座標変換したScreen座標Y
    */
    transformScreenY : function(deviceY)
    {
        return this.deviceToScreen.transformY(deviceY);
    },

    /**
    * Image型オブジェクトからテクスチャを生成
    */
    createTexture : function(gl/*WebGLコンテキスト*/, image/*WebGL Image*/)
    {
        var texture = gl.createTexture(); //テクスチャオブジェクトを作成する
        if ( !texture ){
            console.log("Failed to generate gl texture name.");
            return -1;
        }

        if(this.live2DModel.isPremultipliedAlpha() == false) {
            // 乗算済アルファテクスチャ以外の場合
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }
        // imageを上下反転
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        // テクスチャのユニットを指定する
        gl.activeTexture( gl.TEXTURE0 );
        // テクスチャをバインドする
        gl.bindTexture( gl.TEXTURE_2D , texture );
        // テクスチャに画像データを紐付ける
        gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , gl.RGBA , gl.UNSIGNED_BYTE , image);
        // テクスチャの品質を指定する(対象ピクセルの中心に最も近い点の値)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // ミップマップの品質を指定する
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        // ミップマップの生成
        gl.generateMipmap(gl.TEXTURE_2D);
        // テクスチャのバインド開放
        gl.bindTexture( gl.TEXTURE_2D , null );

        return texture;
    },

    /**
    * ファイルをバイト配列としてロードする
    */
    loadBytes : function(path , callback)
    {
        var request = new XMLHttpRequest();
        request.open("GET", path , true);
        request.responseType = "arraybuffer";
        request.onload = function(){
            switch( request.status ){
            case 200:
                callback( request.response );
                break;
            default:
                console.log( "Failed to load (" + request.status + ") : " + path );
                break;
            }
        }
        request.send(null);
    },

    /**
    * Jsonファイルをロードする
    */
    loadJson : function()
    {
        var thisRef = this;
        var request = new XMLHttpRequest();
        request.open("GET", this.filepath + this.filenm, true);
        request.onreadystatechange = function(){
            if(request.readyState == 4 && request.status == 200){
                // model.jsonから取得
                thisRef.modelDef = JSON.parse(request.responseText);
                // 初期化処理
                thisRef.initLoop();
            }
        }
        request.send(null);
    },

    /**
     * 表情をロードする
     */
    loadExpression : function(name, path){
        var thisRef = this;
        this.loadBytes(path, function(buf) {
            thisRef.expressionsnm[thisRef.expressionsnm.length] = name;
            thisRef.expressions[thisRef.expressions.length] = L2DExpressionMotion.loadJson(buf);
        });
    },

    /**
     * 表情を設定する
     */
    setExpression : function(name)
    {
        var cnt = 0;
        for(var i = 0; i < this.expressionsnm.length; i++){
            if(name == this.expressionsnm[i]){
                break;
            }
            cnt++;
        }
        var expression = this.expressions[cnt];
        this.expressionManager.startMotion(expression, false);
    },

    /**
     * ランダム表情設定する
     */
    setRandomExpression : function()
    {
        // ランダム再生する
        var random = ~~(Math.random() * this.expressions.length);
        var expression = this.expressions[random];
        this.expressionManager.startMotion(expression, false);
    },

    /**
     * モーションを設定する
     */
    setMotion : function(name)
    {
        if(this.modelDef == null)return;

        var cnt = 0;
        // ファイル名からファイル番号を取り出す
        for(var key in this.modelDef.motions){
            for(var j = 0; j < this.modelDef.motions[key].length; j++){
                // 余分なパスをカット
                var strfilenm = this.modelDef.motions[key][j].file.split("/");
                if(name == strfilenm[1]){
                    break;
                }
                cnt++;
            }
        }
        this.motionnm = cnt;
        this.motionflg = true;
    },

    /**
     * ランダムモーション再生する
     */
    setRandomMotion : function()
    {
        if(this.modelDef == null)return;
        // ランダム再生する
        this.motionnm = ~~(Math.random() * this.motions.length);
        this.motionflg = true;
    }
};

/****************************************
* サウンドクラス
****************************************/
var L2DSound = function(path /*音声ファイルパス*/) {
    this.snd = document.createElement("audio");
    this.snd.src = path;
};

L2DSound.prototype = {
    /**
    * 音声再生
    */
    play : function() {
        this.snd.play();
    },

    /**
    * 音声停止
    */
    stop : function() {
        this.snd.pause();
        this.snd.currentTime = 0;
    }
};
