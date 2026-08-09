import test from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_INTERACTIVE_DIALOGUE_STYLE,
  DEFAULT_INTERACTIVE_PROMPT_STYLE,
  INTERACTIVE_SCENE_TRIGGERS,
  applyInteractiveDialogueStyle,
  createInteractiveScene,
  normalizeInteractiveScene,
  resolveInteractiveSceneStage,
  workUsesCameraInteractions,
} from "../js/interactive-scene-model.js"

test("interactive scenes expose swipe and camera-combination triggers", () => {
  assert.deepEqual(INTERACTIVE_SCENE_TRIGGERS, [
    "tap",
    "hold",
    "swipe",
    "face-near",
    "face-near-tap",
    "face-near-hold",
  ])
})

test("new interactive scenes start with one editable stage and shared dialogue style", () => {
  const scene = createInteractiveScene({
    id: "scene-1",
    nodeId: "node-1",
    stageId: "stage-1",
  })

  assert.equal(scene.id, "scene-1")
  assert.equal(scene.nodeId, "node-1")
  assert.equal(scene.startStageId, "stage-1")
  assert.equal(scene.nextNodeId, "")
  assert.equal(scene.stages.length, 1)
  assert.equal(scene.stages[0].promptEnabled, true)
  assert.deepEqual(scene.stages[0].bgm, {
    source:"", fileName:"", volume:70, loop:true,
    durationMs:0, bytes:0, startMs:0, endMs:null,
  })
  assert.deepEqual(scene.canvas, { width:1080, height:1920, backgroundColor:"#40383b" })
  assert.ok(scene.stages[0].prompt)
  assert.deepEqual(scene.stages[0].promptStyle, DEFAULT_INTERACTIVE_PROMPT_STYLE)
  assert.deepEqual(scene.promptStyle, DEFAULT_INTERACTIVE_PROMPT_STYLE)
  assert.deepEqual(scene.dialogueStyle, DEFAULT_INTERACTIVE_DIALOGUE_STYLE)
})

test("interactive scene normalization gives every stage its own compatible prompt style", () => {
  const legacyPromptStyle = {
    surfaceColor:"#112233",
    textColor:"#fefefe",
    borderColor:"#445566",
    opacity:61,
    borderRadius:9,
    position:"free",
    x:22,
    y:31,
    width:64,
    fontFamily:"Georgia, serif",
    fontSize:18,
    lineHeight:1.8,
    letterSpacing:2,
  }
  const scene = normalizeInteractiveScene({
    promptStyle:legacyPromptStyle,
    stages:[
      {
        id:"stage-1",
        prompt:"第一幕",
        promptStyle:{ surfaceColor:"#abcdef", position:"bottom", fontSize:27 },
      },
      { id:"stage-2", prompt:"第二幕" },
      { id:"stage-3", prompt:"第三幕" },
    ],
  })

  assert.deepEqual(scene.stages[0].promptStyle, {
    ...legacyPromptStyle,
    surfaceColor:"#abcdef",
    position:"bottom",
    fontSize:27,
  })
  assert.deepEqual(scene.stages[1].promptStyle, legacyPromptStyle)
  assert.deepEqual(scene.stages[2].promptStyle, legacyPromptStyle)
  assert.notStrictEqual(scene.stages[1].promptStyle, scene.stages[2].promptStyle)

  const imported = normalizeInteractiveScene(JSON.parse(JSON.stringify(scene)))
  assert.deepEqual(imported.stages.map(stage => stage.promptStyle), scene.stages.map(stage => stage.promptStyle))
})

test("interactive scene normalization preserves fixed canvas, authored layers, and free typography", () => {
  const scene = normalizeInteractiveScene({
    canvas:{ width:1920, height:1080, backgroundColor:"#201b1d" },
    promptStyle:{ position:"free", x:22, y:31, fontSize:18, lineHeight:1.8, letterSpacing:2 },
    stages:[{
      id:"stage-1",
      bgm:{ source:"https://example.test/tension.mp3", fileName:"tension.mp3", volume:42, loop:false },
      layers:[{
        id:"glow",
        name:"光圈",
        source:`asset://${"a".repeat(64)}`,
        opacity:64,
        transform:{ scale:1.5, x:12, y:-8 },
      }],
      dialogues:[{
        id:"pressure",
        speaker:"A",
        text:"别看。",
        style:{ position:"free", x:20, y:20, width:55 },
      }],
    }],
  })

  assert.deepEqual(scene.canvas, { width:1920, height:1080, backgroundColor:"#201b1d" })
  assert.equal(scene.promptStyle.position, "free")
  assert.equal(scene.promptStyle.fontSize, 18)
  assert.deepEqual(scene.stages[0].layers[0].transform, { scale:1.5, x:12, y:-8 })
  assert.equal(scene.stages[0].layers[0].opacity, 64)
  assert.equal(scene.stages[0].dialogues[0].style.x, 20)
  assert.deepEqual(scene.stages[0].bgm, {
    source:"https://example.test/tension.mp3",
    fileName:"tension.mp3",
    volume:42,
    loop:false,
    durationMs:0,
    bytes:0,
    startMs:0,
    endMs:null,
  })
})

test("interactive scene prompt visibility remains backward compatible", () => {
  const withLegacyPrompt = normalizeInteractiveScene({
    stages: [{ id: "stage-1", prompt: "点击这里" }],
  })
  const withoutLegacyPrompt = normalizeInteractiveScene({
    stages: [{ id: "stage-1", prompt: "" }],
  })
  const explicitlyHidden = normalizeInteractiveScene({
    stages: [{ id: "stage-1", prompt: "点击这里", promptEnabled: false }],
  })

  assert.equal(withLegacyPrompt.stages[0].promptEnabled, true)
  assert.equal(withoutLegacyPrompt.stages[0].promptEnabled, false)
  assert.equal(explicitlyHidden.stages[0].promptEnabled, false)
})

test("interactive scene normalization preserves a stable fixed continuation node id", () => {
  assert.equal(normalizeInteractiveScene({
    id: "scene-1",
    nodeId: "node-5",
    nextNodeId: "node-9",
    stages: [{ id: "stage-1", hotspots: [] }],
  }).nextNodeId, "node-9")

  assert.equal(normalizeInteractiveScene({
    id: "scene-1",
    nextNodeId: "   ",
    stages: [{ id: "stage-1", hotspots: [] }],
  }).nextNodeId, "")
})

test("interactive scene normalization repairs invalid stage references and clamps hotspots", () => {
  const scene = normalizeInteractiveScene({
    id: "scene-1",
    startStageId: "missing",
    stages: [{
      id: "stage-1",
      image: "https://example.test/scene.gif",
      hotspots: [{
        id: "hotspot-1",
        x: -20,
        y: 110,
        width: 200,
        height: 0,
        trigger: "hold",
        holdMs: 99_999,
        targetStageId: "missing",
      }],
    }],
  })

  assert.equal(scene.startStageId, "stage-1")
  assert.equal(scene.stages[0].hotspots[0].x, 0)
  assert.equal(scene.stages[0].hotspots[0].y, 100)
  assert.equal(scene.stages[0].hotspots[0].width, 100)
  assert.equal(scene.stages[0].hotspots[0].height, 1)
  assert.equal(scene.stages[0].hotspots[0].holdMs, 5000)
  assert.equal(scene.stages[0].hotspots[0].targetStageId, "")
})

test("interactive scene normalization preserves image transforms, hotspot shapes, speakers, and PNG dialogue frames", () => {
  const scene = normalizeInteractiveScene({
    id: "scene-1",
    dialogueStyle: {
      frameImage: "https://example.test/dialogue-frame.png",
      frameOutset: 18,
    },
    stages: [{
      id: "stage-1",
      mediaTransform: { scale: 8, x: -250, y: 42 },
      characterImage: "https://example.test/character.png",
      characterFit: "contain",
      characterTransform: { scale: 1.4, x: 12, y: -8 },
      hotspots: [{
        id: "hotspot-1",
        shape: "polygon",
        referenceAspectRatio: 0.5625,
        points: [{ x: -10, y: 20 }, { x: 110, y: 40 }, { x: 50, y: 120 }],
        speaker: "裴亦惜",
      }],
    }],
  })

  assert.deepEqual(scene.stages[0].mediaTransform, { scale: 4, x: -200, y: 42 })
  assert.equal(scene.stages[0].characterImage, "https://example.test/character.png")
  assert.equal(scene.stages[0].characterFit, "contain")
  assert.deepEqual(scene.stages[0].characterTransform, { scale: 1.4, x: 12, y: -8 })
  assert.equal(scene.stages[0].hotspots[0].shape, "polygon")
  assert.equal(scene.stages[0].hotspots[0].referenceAspectRatio, 0.5625)
  assert.deepEqual(scene.stages[0].hotspots[0].points, [
    { x: 0, y: 20 },
    { x: 100, y: 40 },
    { x: 50, y: 100 },
  ])
  assert.equal(scene.stages[0].hotspots[0].speaker, "裴亦惜")
  assert.equal(scene.dialogueStyle.frameImage, "https://example.test/dialogue-frame.png")
  assert.equal(scene.dialogueStyle.frameOutset, 18)
})

test("camera capability is computed from authored triggers instead of a stored flag", () => {
  const work = {
    requiresCamera: false,
    interactiveScenes: [{
      stages: [{
        hotspots: [{ trigger: "face-near", fallbackTrigger: "hold" }],
      }],
    }],
  }

  assert.equal(workUsesCameraInteractions(work), true)
  work.interactiveScenes[0].stages[0].hotspots[0].trigger = "tap"
  work.requiresCamera = true
  assert.equal(workUsesCameraInteractions(work), false)

  work.interactiveScenes[0].stages[0].hotspots[0].trigger = "face-near-tap"
  assert.equal(workUsesCameraInteractions(work), true)
  work.interactiveScenes[0].stages[0].hotspots[0].trigger = "face-near-hold"
  assert.equal(workUsesCameraInteractions(work), true)
})

test("dialogue style sync changes presentation without overwriting scene content", () => {
  const scene = createInteractiveScene({
    id: "scene-1",
    nodeId: "node-1",
    stageId: "stage-1",
  })
  scene.stages[0].dialogue = { speaker: "裴亦惜", text: "别躲。", style: { opacity: 40 } }
  scene.stages[0].hotspots = [{ id: "hotspot-1", trigger: "tap", dialogue: "碰到了。" }]

  const styled = applyInteractiveDialogueStyle(scene, {
    surfaceColor: "#201b1d",
    textColor: "#fffaf9",
    opacity: 82,
  })

  assert.equal(styled.stages[0].dialogue.text, "别躲。")
  assert.equal(styled.stages[0].hotspots[0].dialogue, "碰到了。")
  assert.equal(styled.stages[0].dialogue.style, undefined)
  assert.equal(styled.dialogueStyle.surfaceColor, "#201b1d")
  assert.equal(styled.dialogueStyle.opacity, 82)
})

test("stage resolution falls back to the scene start stage", () => {
  const scene = createInteractiveScene({
    id: "scene-1",
    nodeId: "node-1",
    stageId: "stage-1",
  })
  scene.stages.push({ id: "stage-2", hotspots: [] })

  assert.equal(resolveInteractiveSceneStage(scene, "stage-2").id, "stage-2")
  assert.equal(resolveInteractiveSceneStage(scene, "missing").id, "stage-1")
})

test("interactive scene normalization preserves hotspot action frames and clamps dialogue height", () => {
  const scene = normalizeInteractiveScene({
    dialogueStyle: { height: 22 },
    stages: [{
      id: "stage-1",
      hotspots: [{
        id: "hotspot-1",
        actionFrame: {
          enabled: true,
          source: "https://example.test/reaction.webm",
          type: "video",
          fit: "contain",
          fileName: "reaction.webm",
          durationMs: 2400,
          gifDurationMs: 900,
        },
      }],
    }],
  })

  assert.equal(scene.dialogueStyle.height, 22)
  assert.deepEqual(scene.stages[0].hotspots[0].actionFrame, {
    enabled: true,
    source: "https://example.test/reaction.webm",
    type: "video",
    fit: "contain",
    fileName: "reaction.webm",
    durationMs: 2400,
    gifDurationMs: 900,
    transform: { scale: 1, x: 0, y: 0 },
  })

  const bounded = normalizeInteractiveScene({
    dialogueStyle: { height: 999 },
    stages: [{ id: "stage-1", hotspots: [{ id: "hotspot-1" }] }],
  })
  assert.equal(bounded.dialogueStyle.height, 45)
  assert.deepEqual(bounded.stages[0].hotspots[0].actionFrame, {
    enabled: false,
    source: "",
    type: "image",
    fit: "cover",
    fileName: "",
    durationMs: 1800,
    gifDurationMs: 0,
    transform: { scale: 1, x: 0, y: 0 },
  })
})
