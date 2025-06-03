<script setup>
import { onBeforeMount, onBeforeUnmount, onMounted } from "vue";
import useViewAPI from '@/core/composables/useViewAPI';
import useSmileStore from "@/core/stores/smilestore";
import fileNames from "@/user/assets/arcEvalFileNames";

const api = useViewAPI()

const smilestore = useSmileStore();

// experiment variables
let arcData;
let gridsList;
let MAX_TASKS;
let NUM_TASKS;
let tutorialGrid;
let taskList;
let tutorialTask;
let grids;

// Internal state.
let CURRENT_INPUT_GRID;
let CURRENT_OUTPUT_GRID;
let TEST_PAIRS;
let CURRENT_TEST_PAIR_INDEX;
let SELECT_DATA;
let COPY_PASTE_DATA;
let IS_TUTORIAL;
let IS_WRITING_SOLUTION;
let IS_FIRST_WRITTEN;
let FIRST_WRITTEN_SOLUTION;
let LAST_WRITTEN_SOLUTION;
let FEEDBACK;
let PREV_OUTPUT_GRID;

// Cosmetic.
let EDITION_GRID_HEIGHT;
let EDITION_GRID_WIDTH;
let MAX_CELL_SIZE;
let mode;

// creating variables to keep track of global information
let taskIndex;
let prevTask;
let taskName;
let numAttempts;
let numActions;
let maxNumAttempts;
let solved;
let toolBar;
let undoStack;

function finish() {
    smilestore.data.arc[taskIndex] = arcData;
    smilestore.saveData();
    api.goNextView();
}

class Grid {
    constructor(height, width, values) {
        this.height = height
        this.width = width
        this.grid = new Array(height)
        for (let i = 0; i < height; i++) {
            this.grid[i] = new Array(width)
            for (let j = 0; j < width; j++) {
                if (
                    values != undefined &&
                    values[i] != undefined &&
                    values[i][j] != undefined
                ) {
                    this.grid[i][j] = values[i][j]
                } else {
                    this.grid[i][j] = 0
                }
            }
        }
    }
}

function floodfillFromLocation(grid, i, j, symbol) {
    i = parseInt(i)
    j = parseInt(j)
    symbol = parseInt(symbol)

    const target = grid[i][j]

    function flow(i, j, symbol, target) {
        if (i >= 0 && i < grid.length && j >= 0 && j < grid[i].length) {
            if (grid[i][j] == target) {
                grid[i][j] = symbol
                flow(i - 1, j, symbol, target)
                flow(i + 1, j, symbol, target)
                flow(i, j - 1, symbol, target)
                flow(i, j + 1, symbol, target)
            }
        }
    }

    // only apply flood fill if target cell is not the
    // current symbol/selected colour
    // otherwise, will cause a recursion stack error
    if (symbol != target) {
        flow(i, j, symbol, target)
    }
}

function parseSizeTuple(size) {
    size = size.split('x')
    if (size.length != 2) {
        alert('Grid size should have the format "3x3", "5x7", etc.')
        return
    }
    if (size[0] < 1 || size[1] < 1) {
        alert('Grid size should be at least 1. Cannot have a grid with no cells.')
        return
    }
    if (size[0] > 30 || size[1] > 30) {
        alert('Grid size should be at most 30 per side. Pick a smaller size.')
        return
    }
    return size
}

function convertSerializedGridToGridObject(values) {
    const height = values.length
    const width = values[0].length
    return new Grid(height, width, values)
}

function fitCellsToContainer(
    jqGrid,
    height,
    width,
    containerHeight,
    containerWidth
) {
    const candidate_height = Math.floor((containerHeight - height) / height)
    const candidate_width = Math.floor((containerWidth - width) / width)
    let size = Math.min(candidate_height, candidate_width)
    size = Math.min(MAX_CELL_SIZE, size)
    jqGrid.find('.cell').css('height', `${size}px`)
    jqGrid.find('.cell').css('width', `${size}px`)
}

function fillJqGridWithData(jqGrid, dataGrid) {
    jqGrid.empty()
    const { height } = dataGrid
    const { width } = dataGrid
    for (let i = 0; i < height; i++) {
        const row = $(document.createElement('div'))
        row.addClass('row')
        for (let j = 0; j < width; j++) {
            const cell = $(document.createElement('div'))
            cell.addClass('cell')
            cell.attr('x', i)
            cell.attr('y', j)
            setCellSymbol(cell, dataGrid.grid[i][j])
            row.append(cell)
        }
        jqGrid.append(row)
    }
}

function copyJqGridToDataGrid(jqGrid, dataGrid) {
    const row_count = jqGrid.find('.row').length
    if (dataGrid.height != row_count) {
        return
    }
    const col_count = jqGrid.find('.cell').length / row_count
    if (dataGrid.width != col_count) {
        return
    }
    jqGrid.find('.row').each((i, row) => {
        $(row)
            .find('.cell')
            .each((j, cell) => {
                dataGrid.grid[i][j] = parseInt($(cell).attr('symbol'))
            })
    })
}

function setCellSymbol(cell, symbol) {
    cell.attr('symbol', symbol)
    let classesToRemove = ''
    for (let i = 0; i < 10; i++) {
        classesToRemove += `symbol_${i} `
    }
    cell.removeClass(classesToRemove)
    cell.addClass(`symbol_${symbol}`)
}

function errorMsg(msg) {
    $('#info_display').stop(true, true)
    $('#info_display').css('color', 'red')
    $('#info_display').css('display', 'inline')
    $('#info_display').css('opacity', '1')
    $('#info_display').css('font-size', '24px')
    $('#info_display').css('font-weight', 'bold')
    $('#info_display').html(msg)
    $('#info_display').animate({ opacity: 0 }, 12500)
}

function infoMsg(msg) {
    $('#info_display').stop(true, true)
    $('#info_display').css('color', 'green')
    $('#info_display').css('display', 'inline')
    $('#info_display').css('opacity', '1')
    $('#info_display').css('font-size', '24px')
    $('#info_display').css('font-weight', 'bold')
    $('#info_display').html(msg)
    $('#info_display').animate({ opacity: 0 }, 12500)
}


// shuffle function from stack overflow
function shuffle(array) {
    let currentIndex = array.length
    let temporaryValue
    let randomIndex

    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex)
        currentIndex -= 1

        // And swap it with the current element.
        temporaryValue = array[currentIndex]
        array[currentIndex] = array[randomIndex]
        array[randomIndex] = temporaryValue
    }

    return array
}

// get grid list and load into memory
function getGridsFromCond() {
    const cond = api.getConditionByName('conds')
    // select the 5 unique tasks using cond
    let gridsLocal = []
    if (cond > NUM_TASKS - MAX_TASKS) {
        const firstHalf = gridsList.slice(cond, cond + (NUM_TASKS - cond))
        const secondHalf = gridsList.slice(0, MAX_TASKS - (NUM_TASKS - cond))
        gridsLocal = firstHalf.concat(secondHalf)
    } else {
        gridsLocal = gridsList.slice(cond, cond + MAX_TASKS)
    }

    // load local data into taskList and tutorialTask
    gridsLocal.forEach((grid) => {
        fetch(`ARC/data/` + `evaluation/${grid}`)
            .then((response) => response.json())
            .then((data) => {
                taskList.push([data, grid])
            })
    })
    shuffle(taskList)

    tutorialGrid.forEach((grid) => {
        fetch(`ARC/data/` + `training/${grid}`)
            .then((response) => response.json())
            .then((data) => {
                tutorialTask.push([data, grid])
            })
    })

    return grids
}

// sleep function
const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))

// save function
function save(
    action,
    action_x = '',
    action_y = '',
    select_loc = '',
    tutorial_response = Array(0, 0, 0, 0)
) {
    // window.numActions++;
    numActions++

    // get current date and time
    const dateTime = new Date().toLocaleString()

    // create object to store info
    const save_list = {
        action,
        action_x,
        action_y,
        num_actions: numActions,
        test_output_grid: outputToString(),
        test_output_size: getOutputSize(),
        test_input_grid: inputToString(),
        test_input_size: getInputSize(),
        selected_tool: getSelectedTool(),
        selected_symbol: getSelectedSymbol(),
        selected_data: SELECT_DATA,
        select_loc,
        copy_paste_data: COPY_PASTE_DATA,
        task_number: taskIndex,
        task_name: taskName,
        attempt_number: numAttempts,
        solved,
        first_written_solution: FIRST_WRITTEN_SOLUTION,
        last_written_solution: LAST_WRITTEN_SOLUTION,
        feedback: FEEDBACK,
        is_tutorial: IS_TUTORIAL,
        tutorial_response,
        time: dateTime,
    }
    arcData.push(JSON.stringify(save_list))
    // console.log(arcData);
}

function verifyMatchWithLastAttemptSolution() {

    if (PREV_OUTPUT_GRID == outputToString()) {
        return true
    }
    return false
}

function undo() {
    if (undoStack.length > 0) {
        CURRENT_OUTPUT_GRID = undoStack.pop()
        syncFromDataGridToEditionGrid()
        save('undo')
    } else {
        alert('No more actions to undo!')
    }
}

// querying variables
function getSelectedTool() {
    mode = $('input[name=tool_switching]:checked').val()
    return mode
}

function getSelectedSymbol() {
    const selected = $('#symbol_picker .selected-symbol-preview')[0]
    return $(selected).attr('symbol')
}

function getOutputSize() {
    const height = $('#height').val()
    const width = $('#width').val()
    return Array(height, width)
}

function getInputSize() {
    const { height } = CURRENT_INPUT_GRID
    const { width } = CURRENT_INPUT_GRID
    return Array(height, width)
}

// converting output grid to string
function outputToString() {
    syncFromEditionGridToDataGrid()
    let stringGrid = '|'
    const dataGrid = JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID.grid))
    for (let i = 0; i < dataGrid.length; i++) {
        if (i == dataGrid.length - 1) {
            stringGrid = stringGrid.concat(dataGrid[i].join(''))
        } else {
            stringGrid = stringGrid.concat(dataGrid[i].join(''))
            stringGrid = stringGrid.concat('|')
        }
    }
    stringGrid = stringGrid.concat('|')

    return stringGrid
}

function inputToString() {
    let stringGrid = '|'
    const dataGrid = JSON.parse(JSON.stringify(CURRENT_INPUT_GRID.grid))
    for (let i = 0; i < dataGrid.length; i++) {
        if (i == dataGrid.length - 1) {
            stringGrid = stringGrid.concat(dataGrid[i].join(''))
        } else {
            stringGrid = stringGrid.concat(dataGrid[i].join(''))
            stringGrid = stringGrid.concat('|')
        }
    }
    stringGrid = stringGrid.concat('|')

    return stringGrid
}

// Text helpers
function help() {
    alert('The left side is the input, the right side is the output')
    const msg = 'Instructions'
    $('#error_display').stop(true, true)
    $('#info_display').stop(true, true)

    $('#error_display').hide()
    $('#info_display').hide()
    $('#help_text').html(msg)
    $('#help_text').show()
    $('#help_text').fadeOut(5000)
}

function resetTask() {
    CURRENT_INPUT_GRID = new Grid(3, 3)
    TEST_PAIRS = new Array()
    CURRENT_TEST_PAIR_INDEX = 0
    $('#task_preview').html('')
    resetOutputGrid()
}

function refreshEditionGrid(jqGrid, dataGrid) {
    fillJqGridWithData(jqGrid, dataGrid)
    setUpEditionGridListeners(jqGrid)
    fitCellsToContainer(
        jqGrid,
        dataGrid.height,
        dataGrid.width,
        EDITION_GRID_HEIGHT,
        EDITION_GRID_HEIGHT
    )
    initializeSelectable()
}

function syncFromEditionGridToDataGrid() {
    copyJqGridToDataGrid($('#output_grid .edition_grid'), CURRENT_OUTPUT_GRID)
}

function syncFromDataGridToEditionGrid() {
    refreshEditionGrid($('#output_grid .edition_grid'), CURRENT_OUTPUT_GRID)
}

function setUpEditionGridListeners(jqGrid) {
    jqGrid.find('.cell').click((event) => {
        const cell = $(event.target)
        const symbol = getSelectedSymbol()

        const mode = $('input[name=tool_switching]:checked').val()
        if (mode == 'floodfill') {
            // If floodfill: fill all connected cells.
            // add current grid to undo stack
            undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))

            syncFromEditionGridToDataGrid()
            const { grid } = CURRENT_OUTPUT_GRID
            floodfillFromLocation(grid, cell.attr('x'), cell.attr('y'), symbol)
            syncFromDataGridToEditionGrid()
            const action = 'floodfill'
            const action_x = cell.attr('x')
            const action_y = cell.attr('y')
            save(action, action_x, action_y)
        } else if (mode == 'edit') {
            if (cell.attr('symbol') != symbol) {
                // only set cell if its not already that color
                // add current grid to undo stack
                undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))

                setCellSymbol(cell, symbol)
                const action = 'edit'
                const action_x = cell.attr('x')
                const action_y = cell.attr('y')
                save(action, action_x, action_y)
            }
        }
    })

    // set up toggle to allow for draggable edit mode
    let isToggle = false

    // turn draggable mode on when mouse is held down on an output cell
    jqGrid.find('.cell').mousedown((event) => {
        mode = $('input[name=tool_switching]:checked').val()
        if (mode == 'edit') {
            isToggle = true
        }
    })

    // turn draggable mode off when mouse up is performed (even outside of the grid)
    window.addEventListener('mouseup', (event) => {
        mode = $('input[name=tool_switching]:checked').val()
        if (isToggle && mode == 'edit') {
            isToggle = false
        }
    })

    jqGrid.find('.cell').mousemove((event) => {
        mode = $('input[name=tool_switching]:checked').val()

        if (isToggle && mode == 'edit') {
            const cell = $(event.target)
            const symbol = getSelectedSymbol()

            if (cell.attr('symbol') != symbol) {
                // add current grid to undo stack
                undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))

                setCellSymbol(cell, symbol)
                const action = 'edit'
                const action_x = cell.attr('x')
                const action_y = cell.attr('y')
                save(action, action_x, action_y)
            }
        }
    })
}

function resizeOutputGrid() {
    const height = $('#height').val()
    const width = $('#width').val()

    const jqGrid = $('#output_grid .edition_grid')
    syncFromEditionGridToDataGrid()
    const dataGrid = JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID.grid))
    CURRENT_OUTPUT_GRID = new Grid(height, width, dataGrid)
    refreshEditionGrid(jqGrid, CURRENT_OUTPUT_GRID)

    SELECT_DATA = []
}

function resetColorBlack() {
    const symbol_preview = $('#selected_first')
    $('#symbol_picker')
        .find('.symbol_preview')
        .each((i, preview) => {
            $(preview).removeClass('selected-symbol-preview')
        })
    symbol_preview.addClass('selected-symbol-preview')
}

function resetOutputGrid() {
    // add current grid to undo stack
    undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))

    syncFromEditionGridToDataGrid()
    CURRENT_OUTPUT_GRID = new Grid(3, 3)
    syncFromDataGridToEditionGrid()

    // resize grid
    const jqGrid = $('#output_grid .edition_grid')
    syncFromEditionGridToDataGrid()
    const dataGrid = JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID.grid))
    CURRENT_OUTPUT_GRID = new Grid(3, 3, dataGrid)
    refreshEditionGrid(jqGrid, CURRENT_OUTPUT_GRID)

    // set drop down values
    const height = $('#height').val(3).change
    const width = $('#width').val(3).change

    // set color selector back to black
    resetColorBlack()

    // set initial tool to be edit
    document.getElementById('tool_edit').checked = true

    // clear clipboard and selected data
    COPY_PASTE_DATA = []
    SELECT_DATA = []

    infoMsg('Resetting Test Output grid')
    const action = 'reset_grid'
    save(action)
}

function copyFromInput() {
    // add current grid to undo stack
    undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))

    syncFromEditionGridToDataGrid()
    CURRENT_OUTPUT_GRID = convertSerializedGridToGridObject(
        CURRENT_INPUT_GRID.grid
    )
    syncFromDataGridToEditionGrid()
    // changing this code
    // $('#output_grid_size').val(CURRENT_OUTPUT_GRID.height + 'x' + CURRENT_OUTPUT_GRID.width);
    $('#output_grid_size').val(
        CURRENT_OUTPUT_GRID.height,
        CURRENT_OUTPUT_GRID.width
    )

    // modify grid size values
    $('#height').val(CURRENT_OUTPUT_GRID.height)
    $('#width').val(CURRENT_OUTPUT_GRID.width)

    // clear selected data
    SELECT_DATA = []

    infoMsg('Copied Test Input grid to Test Output')
    const action = 'copy_from_input'
    save(action)
}

function solve() {
    // function to automatically solve the task
    const reference_output = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX].output
    syncFromEditionGridToDataGrid()
    CURRENT_OUTPUT_GRID = convertSerializedGridToGridObject(reference_output)
    syncFromDataGridToEditionGrid()

    $('#output_grid_size').val(
        CURRENT_OUTPUT_GRID.height,
        CURRENT_OUTPUT_GRID.width
    )

    // modify grid size values
    $('#height').val(CURRENT_OUTPUT_GRID.height)
    $('#width').val(CURRENT_OUTPUT_GRID.width)

    const action = 'auto_solve'
    save(action)

    if (IS_TUTORIAL) {
        $('#submit_tutorial_solution_btn').click()
        $('#write_solution_box').val('test')
        $('#submit_tutorial_description_btn').click()
    } else {
        $('#submit_solution_btn').click()
        $('#write_solution_box').val('test')
        $('#submit_description_btn').click()
    }
}

function fillPairPreview(pairId, inputGrid, outputGrid) {
    let pairSlot = $(`#pair_preview_${pairId}`)
    if (!pairSlot.length) {
        // Create HTML for pair.
        pairSlot = $(
            `<div id="pair_preview_${pairId}" class="pair_preview" index="${pairId}"></div>`
        )
        pairSlot.appendTo('#task_preview')
    }
    let jqInputGrid = pairSlot.find('.input_preview')
    if (!jqInputGrid.length) {
        jqInputGrid = $('<div class="input_preview"></div>')
        // Adding a header to each input/ouput pair in demonstration
        var name = $(
            `<div class="subTextLeft" id="task_header">Example Input ${pairId + 1
            }</div>`
        )
        const leftGrid = $(
            `<div id = "left_block_${pairId}" class="preview_block"></div>`
        )
        leftGrid.appendTo(pairSlot)
        name.appendTo(leftGrid)
        jqInputGrid.appendTo(leftGrid)
    }
    let jqOutputGrid = pairSlot.find('.output_preview')
    if (!jqOutputGrid.length) {
        jqOutputGrid = $('<div class="output_preview"></div>')
        // jqOutputGrid.appendTo(pairSlot);
        var name = $(
            `<div class="subTextRight" id="task_header">Example Output ${pairId + 1
            }</div>`
        )
        const rightGrid = $(
            `<div id = "right_block_${pairId}" class="preview_block"></div>`
        )
        rightGrid.appendTo(pairSlot)
        name.appendTo(rightGrid)
        jqOutputGrid.appendTo(rightGrid)
    }

    fillJqGridWithData(jqInputGrid, inputGrid)
    fitCellsToContainer(jqInputGrid, inputGrid.height, inputGrid.width, 200, 200)
    fillJqGridWithData(jqOutputGrid, outputGrid)
    fitCellsToContainer(
        jqOutputGrid,
        outputGrid.height,
        outputGrid.width,
        200,
        200
    )
}

function loadJSONTask(train, test) {
    $('#modal_bg').hide()
    $('#error_display').hide()
    $('#info_display').hide()

    resetTask()

    for (let i = 0; i < train.length; i++) {
        const pair = train[i]
        let values = pair.input
        const input_grid = convertSerializedGridToGridObject(values)
        values = pair.output
        const output_grid = convertSerializedGridToGridObject(values)
        fillPairPreview(i, input_grid, output_grid)
    }
    // only use first test pair
    // for (var i=0; i < test.length; i++) {
    //     pair = test[i];
    //     TEST_PAIRS.push(pair);
    // }
    TEST_PAIRS.push(test[0])
    // finish mod
    const values = TEST_PAIRS[0].input
    CURRENT_INPUT_GRID = convertSerializedGridToGridObject(values)
    fillTestInput(CURRENT_INPUT_GRID)
    CURRENT_TEST_PAIR_INDEX = 0
    $('#current_test_input_id_display').html('1')
    // change this to 1
    // $("#total_test_input_count_display").html(test.length);
    $('#total_test_input_count_display').html('1')
}

function loadNextTask() {
    smilestore.data.arc[taskIndex] = arcData
    smilestore.saveData()
    arcData = []
    // reset boolean tracking whether task is solved
    numAttempts = 1
    solved = false
    FIRST_WRITTEN_SOLUTION = ''
    LAST_WRITTEN_SOLUTION = ''
    IS_WRITING_SOLUTION = false
    IS_FIRST_WRITTEN = true
    undoStack = [new Grid(3, 3)]

    // load next task
    const subset = 'training'
    const task = taskList[taskIndex]
    taskIndex += 1
    verify(task)


    // $.getJSON("https://api.github.com/repos/fchollet/ARC/contents/data/" + subset,
    //     function (tasks) {
    //         const task = tasks[taskList[taskIndex][1]];
    //         verify(task);
    //         taskIndex++;
    //     })
    //     .error(function () {
    //         errorMsg('Error loading task list');
    //     });
}

function loadTaskFromFile(e) {
    console.log(e)
    const file = e.target.files[0]
    if (!file) {
        errorMsg('No file selected')
        return
    }
    // window.prevTask = file["name"];
    prevTask = file.name
    const reader = new FileReader()
    reader.onload = function (e) {
        let contents = e.target.result

        try {
            contents = JSON.parse(contents)
            train = contents.train
            test = contents.test
        } catch (e) {
            errorMsg('Bad file format')
            return
        }
        loadJSONTask(train, test)
    }
    reader.readAsText(file)
}

// Helper functions for loading different tasks
function startTutorial() {
    // hide other pages
    $('#model_bg').hide()
    $('#experiment_finish').hide()
    $('#tutorial_container').show()
}

function finishTutorial() {
    sleep(1000).then(() => {
        LAST_WRITTEN_SOLUTION = document.getElementById('write_solution_box').value
        console.log(LAST_WRITTEN_SOLUTION)
        if (LAST_WRITTEN_SOLUTION == '') {
            errorMsg(
                'Please describe your solution to this task before pressing the Submit button'
            )
        } else {
            const action = 'write_last_tutorial_description'
            save(action)
            resetEditor()
            tutorialQuiz()
        }
    })
}

function tutorialQuiz() {
    $('#tutorial_container').hide()
    $('#workspace').hide()
    $('#experiment_finish').hide()
    $('#tutorial_quiz').show()
    $('#tutorial_quiz_btn').show()

    $('html,body').scrollTop(0)
}

function evalAnswers() {
    const q1_val = document.querySelector('input[name="y/n"]:checked').value
    const q2 = document.getElementById('attempts_question')
    const q2_val = q2.options[q2.selectedIndex].value
    const q3 = document.getElementById('tasks_question')
    const q3_val = q3.options[q3.selectedIndex].value
    const q4 = document.getElementById('bonus_question')
    const q4_val = q4.options[q4.selectedIndex].value
    if (q1_val == 'yes' || q2_val != 3 || q3_val != MAX_TASKS || q4_val != 1) {
        $('#incorrect_submission').stop(true, true)
        $('#incorrect_submission').css('visibility', 'visible')
        $('#incorrect_submission').css('opacity', '1')
        $('#incorrect_submission').animate({ opacity: 0 }, 5000)
    } else {
        $('#correct_submission').stop(true, true)
        $('#correct_submission').css('visibility', 'visible')
        $('#correct_submission').css('opacity', '1')
        $('#correct_submission').animate({ opacity: 0 }, 5000)
        startExperiment()
    }
    // save(action="tutorial_questions", tutorial_response=Array((q1_val == "No", q2_val == 3, q3_val == 10, q4_val == 1)))
    // sleep(2000).then(() => {
    //         startExperiment();
    //     });
}

function resetEditor() {
    $('#write_solution').hide()
    $('#write_solution_box').first().val('')
    $('#submit_tutorial_solution_btn').hide()
    $('#submit_tutorial_description_btn').hide()
    $('#submit_solution_btn').show()
    $('#editor_grid_control_btns').show()

    IS_TUTORIAL = false
}

function startExperiment() {
    $('#modal_bg').hide()
    $('#tutorial_container').hide()
    $('#tutorial_nav').hide()
    $('#tutorial_quiz').hide()
    $('#experiment_finish').hide()
    $('#workspace').show()
    $('#evaluation-input-view').show()

    loadNextTask()
    resetEditor()
}

function nextTask() {
    sleep(1000).then(() => {
        LAST_WRITTEN_SOLUTION = document.getElementById('write_solution_box').value
        if (solved == true) {
            const action = 'no_last_description'
            save(action)
            resetEditor()
            // window.numAttempts = 1;
            numAttempts = 1
            if (taskIndex == MAX_TASKS) {
                $('#write_solution_box').first().val('')
                finishExperiment()
            } else {
                loadNextTask()
            }
        } else if (LAST_WRITTEN_SOLUTION == '') {
            errorMsg(
                'Please describe your solution to this task before pressing the Submit button'
            )
        } else {
            const action = 'write_last_description'
            save(action)
            resetEditor()
            // window.numAttempts = 1;
            numAttempts = 1

            // show final page if participant has finished all tasks
            // console.log(taskIndex);
            if (taskIndex == MAX_TASKS) {
                $('#write_solution_box').first().val('')
                finishExperiment()
            } else {
                loadNextTask()
                // loadNextTask();
            }
        }
    })
}

function finishExperiment() {
    $('#modal_bg').hide()
    $('#tutorial_container').hide()
    $('#tutorial_nav').hide()
    $('#workspace').hide()
    $('#experiment_finish').show()
}

function submitResults() {
    FEEDBACK = document.getElementById('feedback_box').value
    if (FEEDBACK != '') {
        const action = 'submit_feedback'
        save(action)
        finish()
    }
}

function verify(task) {
    const { train } = task[0]
    const { test } = task[0]
    taskName = task[1]
    numActions = 0
    loadJSONTask(train, test)
    updateInfoBar()
    // $.getJSON(task["download_url"], function (json) {
    //     try {
    //         var train = json['train'];
    //         var test = json['test'];
    //     } catch (e) {
    //         errorMsg('Bad file format');
    //         return;
    //     }
    //     // window.taskName = task.name; // update task name
    //     // window.numActions = 0; // reset number of actions
    //     taskName = task.name;
    //     numActions = 0;
    //     loadJSONTask(train, test);
    //     updateInfoBar();
    // })
    //     .error(function () {
    //         errorMsg('Error loading task');
    //     });
}

function updateInfoBar() {
    if (IS_TUTORIAL) {
        $('#current_task span').html('<strong>Task</strong>: Tutorial Example')
    } else {
        $('#current_task span').html(
            `<strong>Task</strong>: ${taskIndex}/${MAX_TASKS}&nbsp;&nbsp;&nbsp;` +
            `<strong>Attempt</strong>: ${numAttempts}/${maxNumAttempts}`
        )
    }
}

function submitWrittenFirst() {
    if (IS_TUTORIAL) {
        $('#submit_solution_btn').hide()
        $('#submit_description_btn').hide()
        $('#submit_tutorial_description_btn').hide()
        $('#submit_first_description_btn').show()
    } else {
        $('#submit_tutorial_solution_btn').hide()
        $('#submit_tutorial_description_btn').hide()
        $('#submit_description_btn').hide()
        $('#submit_first_description_btn').show()
    }

    $('#editor_grid_control_btns').hide()
    $('#write_solution').show()

    if (IS_TUTORIAL) {
        $('#write_solution_text').html(
            'Before you receive feedback, you will be asked to describe your solution. After you submit either three incorrect solutions or one correct solution you will be asked for a final description. If you get it right on the first attempt you will not be asked for another description. For this tutorial please write the following solution to this task: <strong>Create a checkerboard pattern by alternating between the two colors in each row.</strong> This solution is approximately the length and generality we hope for in your responses. When you are done, please press the Submit button to continue.'
        )
    } else {
        $('#write_solution_text').text(
            'Please describe what you thought the rule was to transform the input to the output for this task. When you are done, please press the Submit button to continue.'
        )
    }

    IS_WRITING_SOLUTION = true
}

function submitWritten() {
    document.getElementById('write_solution_box').value = ''
    if (IS_TUTORIAL) {
        $('#submit_solution_btn').hide()
        $('#submit_description_btn').hide()
        $('#submit_tutorial_description_btn').show()
    } else {
        $('#submit_tutorial_solution_btn').hide()
        $('#submit_tutorial_description_btn').hide()
        $('#submit_description_btn').show()
    }

    $('#editor_grid_control_btns').hide()
    $('#write_solution').show()

    if (IS_TUTORIAL) {
        // tutorial only gets here if solved
        $('#write_solution_text').html(
            'Congratulations, you solved the tutorial task! In the main experiment, after either solving the task, or three incorrect attempts you will be asked to write a description of your solution in the text box below. For this tutorial please write the following solution to this task: <strong>Create a checkerboard pattern by alternating between the two colors in each row.</strong> This solution is approximately the length and generality we hope for in your responses. When you are done, please press the Submit button to continue.'
        )
    } else if (solved) {
        $('#write_solution_text').text(
            'You correctly solved this task! Please describe your solution to this task using as many words as necessary. Your description will be passed onto another person, who will be asked to reproduce the correct answer with only the Test Input and your description provided, so make sure to provide enough detail in your response. When you are done, please press the Submit button to continue.'
        )
    } else if (!solved) {
        $('#write_solution_text').text(
            'Unfortunately, you made three unsuccessful attempts at solving this task. Please describe what you thought was the rule to transform the input to the output for this task. When you are done, please press the Submit button to continue.'
        )
    }

    IS_WRITING_SOLUTION = true
}

function firstDescription() {
    FIRST_WRITTEN_SOLUTION = document.getElementById('write_solution_box').value
    if (FIRST_WRITTEN_SOLUTION == '') {
        errorMsg(
            'Please describe your solution to this task before pressing the Submit button'
        )
    } else if (IS_TUTORIAL) {
        const action = 'write_first_tutorial_description'
        save(action)
        $('#submit_solution_btn').hide()
        $('#submit_description_btn').hide()
        $('#submit_tutorial_description_btn').show()
        $('#submit_first_description_btn').hide()

        $('#editor_grid_control_btns').show()
        $('#write_solution').hide()

        FIRST_WRITTEN_SOLUTION = ''
        // $('#write_solution_box').first().val("");
        IS_FIRST_WRITTEN = false
        IS_WRITING_SOLUTION = false
        submitTutorial()
    } else {
        const action = 'write_first_description'
        save(action)
        $('#submit_tutorial_solution_btn').hide()
        $('#submit_tutorial_description_btn').hide()
        $('#submit_description_btn').show()
        $('#submit_first_description_btn').hide()

        $('#editor_grid_control_btns').show()
        $('#write_solution').hide()

        FIRST_WRITTEN_SOLUTION = ''
        // $('#write_solution_box').first().val("");
        IS_FIRST_WRITTEN = false
        IS_WRITING_SOLUTION = false
        submitSolution()
    }
}

function submitTutorial() {
    console.log(`SOLVED?: ${solved}`)
    if (IS_FIRST_WRITTEN) {
        submitWrittenFirst()
        return
    }

    syncFromEditionGridToDataGrid()
    const reference_output = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX].output
    const submitted_output = CURRENT_OUTPUT_GRID.grid

    // clear any selected cells
    $('.ui-selected').each((i, e) => {
        $(e).removeClass('ui-selected')
    })

    SELECT_DATA = []

    for (let i = 0; i < reference_output.length; i++) {
        const ref_row = reference_output[i]
        for (let j = 0; j < ref_row.length; j++) {
            if (ref_row[j] !== submitted_output[i][j]) {
                const action = 'submit_tutorial'
                save(action)
                // window.numAttempts++;
                numAttempts++
                console.log('added one attempt from submit tutorial')
                errorMsg('Your response was incorrect, please try again')
                return
            }
        }
    }

    infoMsg('Your response was correct!')
    solved = true
    const action = 'submit_tutorial'
    save(action)
    if (numAttempts == 1) {
        finishTutorial()
    } else {
        submitWritten()
    }
}

function submitSolution() {
    if (IS_FIRST_WRITTEN) {
        PREV_OUTPUT_GRID = outputToString()
        submitWrittenFirst()
        return
    }

    if (verifyMatchWithLastAttemptSolution() && numAttempts > 1) {
        errorMsg('You have already submitted this solution')
        return
    }

    PREV_OUTPUT_GRID = outputToString()

    syncFromEditionGridToDataGrid()
    const reference_output = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX].output
    const submitted_output = CURRENT_OUTPUT_GRID.grid

    // clear any selected cells
    $('.ui-selected').each((i, e) => {
        $(e).removeClass('ui-selected')
    })

    SELECT_DATA = []

    for (let i = 0; i < reference_output.length; i++) {
        const ref_row = reference_output[i]
        for (let j = 0; j < ref_row.length; j++) {
            if (ref_row[j] !== submitted_output[i][j]) {
                const action = 'submit'
                save(action)
                numAttempts++
                console.log(
                    'added one attempt from submit solution when output at some cell was wrong'
                )
                if (numAttempts > maxNumAttempts) {
                    errorMsg('You made three errors, you will move on to the next task')
                    submitWritten()
                } else {
                    updateInfoBar()
                    errorMsg('Your response was incorrect, please try again')
                }
                return
            }
        }
    }

    if (
        reference_output.length != submitted_output.length ||
        reference_output[0].length != submitted_output[0].length
    ) {
        const action = 'submit'
        save(action)
        // window.numAttempts++;
        numAttempts++
        console.log('added one attempt from submit solution when length was wrong')
        if (numAttempts > maxNumAttempts) {
            errorMsg('You made three errors, you will move on to the next task')
            submitWritten()
        } else {
            updateInfoBar()
            errorMsg('Your response was incorrect, please try again')
        }
        return
    }

    infoMsg('Your response was correct!')
    solved = true
    const action = 'submit'
    save(action)
    if (numAttempts == 1) {
        nextTask()
    } else {
        submitWritten()
    }
}

function nextTestInput() {
    if (TEST_PAIRS.length <= CURRENT_TEST_PAIR_INDEX + 1) {
        errorMsg('No next test input. Pick another file?')
        return
    }
    CURRENT_TEST_PAIR_INDEX += 1
    const values = TEST_PAIRS[CURRENT_TEST_PAIR_INDEX].input
    CURRENT_INPUT_GRID = convertSerializedGridToGridObject(values)
    fillTestInput(CURRENT_INPUT_GRID)
    $('#current_test_input_id_display').html(CURRENT_TEST_PAIR_INDEX + 1)
    $('#total_test_input_count_display').html(test.length)
}

function fillTestInput(inputGrid) {
    const jqInputGrid = $('#evaluation_input')
    fillJqGridWithData(jqInputGrid, inputGrid)
    fitCellsToContainer(jqInputGrid, inputGrid.height, inputGrid.width, 400, 400)
}

function initializeSelectable() {
    try {
        $('.selectable_grid').selectable('destroy')
    } catch (e) {
        console.log(e)
    }
    const toolMode = $('input[name=tool_switching]:checked').val()
    if (toolMode == 'select') {
        // infoMsg('Click and drag to select cells on the grid. Click on another color to change the color of all selected cells, or press C to copy the selected cells to the clipboard');
        infoMsg(
            'Switched to Select Tool, click and drag to select cells, then copy by pressing C or change color by clicking new color'
        )
        $('.selectable_grid').selectable({
            autoRefresh: false,
            filter: '> .row > .cell',
            start(event, ui) {
                $('.ui-selected').each((i, e) => {
                    $(e).removeClass('ui-selected')
                })
            },
            stop(event, ui) {
                // log data that is selected
                let select_loc = ''
                const selected = $('.ui-selected')

                // check if selected is from test input or test output
                if (
                    selected.parent().parent().parent().attr('id') ==
                    'evaluation-input-view'
                ) {
                    select_loc = 'test_input'
                } else if (
                    selected.parent().parent().parent().attr('id') == 'output_grid'
                ) {
                    select_loc = 'test_output'
                }

                SELECT_DATA = []
                for (let i = 0; i < selected.length; i++) {
                    const x = parseInt($(selected[i]).attr('x'))
                    const y = parseInt($(selected[i]).attr('y'))
                    SELECT_DATA.push([x, y])
                }

                const action = 'select_cells'
                const action_x = $(selected[0]).attr('x')
                const action_y = $(selected[0]).attr('y')
                save(action, action_x, action_y, (select_loc = select_loc))
            },
        })
    } else if (toolMode == 'edit') {
        infoMsg('Switched to Edit Tool')
        SELECT_DATA = []
    } else if (toolMode == 'floodfill') {
        infoMsg('Switched to Flood Fill Tool')
        SELECT_DATA = []
    }
}

// tutorial slideshow code
let slideIndex = 0

// next/previous controls
function plusSlides(n) {
    showSlides((slideIndex += n))
}

// thumbnail image controls
function currentSlide(n) {
    showSlides((slideIndex = n))
}

function showSlides() {
    $('#modal_bg').hide()
    $('#modal').hide()
    $('#tutorial_container').show()
    $('#tutorial_nav').show()

    let i
    const n = slideIndex

    const slides = $('.tutorial_slide')
    const dots = $('.dot')

    if (n < 0) {
        slideIndex = 0 // prevent going past the first slide
    } else if (n >= 0 && n < slides.length) {
        // update active slide
        for (i = 0; i < slides.length; i++) {
            slides[i].style.display = 'none'
        }

        for (i = 0; i < dots.length; i++) {
            dots[i].className = dots[i].className.replace(' active', '')
        }

        slides[slideIndex].style.display = 'block'
        dots[slideIndex].className += ' active'
    } else if (n >= slides.length) {
        // hide slides and start tutorial task
        for (i = 0; i < slides.length; i++) {
            slides[i].style.display = 'none'
        }
        startTutorialTask()
    }
}

function startTutorialTask() {
    // go to the tutorial task
    // hide tutorial stuff
    $('#tutorial_container').hide()
    $('#tutorial_nav').hide()
    $('.prev').hide()
    $('.next').hide()
    $('#submit_solution_btn').hide()

    // display workspace
    $('#workspace').show()
    const task = tutorialTask[0]
    verify(task)
}

function showHelpModal() {
    help_modal.style.display = 'block'
    const action = 'Help'
    save(action)
}

function hideHelpModal() {
    help_modal.style.display = 'none'
}

/* Arc experiment */

const ARC_Experiment = function () {
    // First, collect demographic information from instructions
    // var gender_val = document.querySelector('input[name="gender"]:checked').value;
    // var age_val = document.getElementById("age").value;
    // console.log(gender_val,age_val)
    // psiTurk.recordTrialData({gender:gender_val,age:age_val});
    // psiTurk.saveData();
    // Load the stage.html snippet into the body of the page
    // psiTurk.showPage('stage.html');
    // this function runs when the page is loaded
    $(document).ready(() => {
        // show an alert if user tries to navigate away from this page
        // window.onbeforeunload = function() {
        //     return "You have not completed the experiment.";
        // };
        // set up click functionality for the color change panel
        let toolMode
        $('#symbol_picker')
            .find('.symbol_preview')
            .click((event) => {
                const symbol_preview = $(event.target)
                $('#symbol_picker')
                    .find('.symbol_preview')
                    .each((i, preview) => {
                        $(preview).removeClass('selected-symbol-preview')
                    })
                symbol_preview.addClass('selected-symbol-preview')

                if (
                    toolMode == 'select' &&
                    $('.edition_grid').find('.ui-selected').length > 0
                ) {
                    // add current grid to undo stack
                    undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))
                    $('.edition_grid')
                        .find('.ui-selected')
                        .each((i, cell) => {
                            const symbol = getSelectedSymbol()
                            setCellSymbol($(cell), symbol)
                        })
                    const action = 'select_change_color'
                    save(action)
                } else {
                    // for edit and flood fill modes
                    const action = 'change_color'
                    save(action)
                }
            })

        $('.edition_grid').each((i, jqGrid) => {
            setUpEditionGridListeners($(jqGrid))
        })

        $('.load_task').on('change', (event) => {
            loadTaskFromFile(event)
        })

        $('.load_task').on('click', (event) => {
            event.target.value = ''
        })

        $('input[type=radio][name=tool_switching]').change(() => {
            toolMode = $('input[name=tool_switching]:checked').val()
            initializeSelectable()
            const action = 'change_tool'
            save(action)
        })

        $('body').keydown((event) => {
            // Copy and paste functionality.
            if (event.which == 67) {
                // Press C
                const selected = $('.ui-selected')
                if (selected.length == 0) {
                    return
                }

                if (IS_WRITING_SOLUTION) {
                    // don't trigger copy when writing solutions
                    return
                }

                COPY_PASTE_DATA = []
                for (var i = 0; i < selected.length; i++) {
                    const x = parseInt($(selected[i]).attr('x'))
                    const y = parseInt($(selected[i]).attr('y'))
                    const symbol = parseInt($(selected[i]).attr('symbol'))
                    COPY_PASTE_DATA.push([x, y, symbol])
                }
                infoMsg(
                    'Copied cells to clipboard, select a single target cell in the Test Output and press V to paste at that location'
                )
                const action = 'select_copy'
                save(action)
            }
            if (event.which == 86) {
                // Press V
                if (IS_WRITING_SOLUTION) {
                    // don't trigger when writing solutions
                    return
                }

                if (COPY_PASTE_DATA.length == 0) {
                    errorMsg(
                        'The clipboard is empty, please select some cells and press C to copy first'
                    )
                    return
                }
                const selected = $('.edition_grid').find('.ui-selected')
                if (selected.length == 0) {
                    errorMsg(
                        'Please select a single target cell in the Test Output to paste'
                    )
                    return
                }

                const jqGrid = $(selected.parent().parent()[0])

                if (selected.length == 1) {
                    console.log('Pasting to cells')
                    const targetx = parseInt(selected.attr('x'))
                    const targety = parseInt(selected.attr('y'))

                    const xs = new Array()
                    const ys = new Array()
                    const symbols = new Array()

                    for (var i = 0; i < COPY_PASTE_DATA.length; i++) {
                        xs.push(COPY_PASTE_DATA[i][0])
                        ys.push(COPY_PASTE_DATA[i][1])
                        symbols.push(COPY_PASTE_DATA[i][2])
                    }

                    const minx = Math.min(...xs)
                    const miny = Math.min(...ys)
                    for (var i = 0; i < xs.length; i++) {
                        const x = xs[i]
                        const y = ys[i]
                        const symbol = symbols[i]
                        const newx = x - minx + targetx
                        const newy = y - miny + targety
                        const res = jqGrid.find(`[x="${newx}"][y="${newy}"] `)
                        if (res.length == 1) {
                            const cell = $(res[0])
                            setCellSymbol(cell, symbol)
                        }
                    }

                    infoMsg('Successfully pasted cells from clipboard!')
                    const action = 'select_paste'
                    save(action, targetx, targety)
                } else {
                    errorMsg(
                        'Can only paste at a specific location; only select *one* cell as paste destination.'
                    )
                }
            }
        })

        // add things to detect if height or width are resized
        $('#height').change(() => {
            // add current grid to undo stack
            undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))
            resizeOutputGrid()
            const action = 'change_height'
            save(action)
        })

        $('#width').change(() => {
            // add current grid to undo stack
            undoStack.push(JSON.parse(JSON.stringify(CURRENT_OUTPUT_GRID)))
            resizeOutputGrid()
            const action = 'change_width'
            save(action)
        })

        // help modal
        const help_modal = document.getElementById('help_modal')
        console.log(help_modal)

        // Get the button that opens the modal
        // var btn = document.getElementById("myBtn");
        // Get the <span> element that closes the modal
        const span = document.getElementsByClassName('close')[0]

        // When the user clicks on the button, open the help_modal
        // btn.onclick = function() {
        //   help_modal.style.display = "block";
        // }
        // When the user clicks on <span> (x), close the modal
        span.onclick = function () {
            help_modal.style.display = 'none'
        }

        // When the user clicks anywhere outside of the modal, close it
        window.onclick = function (event) {
            if (event.target == help_modal) {
                help_modal.style.display = 'none'
            }
        }

        // hide other elements of the experiment initially
        $('#tutorial_container').hide()
        $('#tutorial_nav').hide()
        $('#tutorial_quiz').hide()
        $('#workspace').hide()
        $('#experiment_finish').hide()

        // start tutorial
        showSlides()
    })
}

function beforeUnloadHandler(event) {
    const message =
        'Refreshing the browser might cause problems! Are you sure you want to refresh? You may not be able to continue the study. Otherwise, please use the withdraw button to exit the study and tell us why you withdrew.'
    smilestore.data.reloaded_unity = true
    event.preventDefault()
    event.returnValue = message
    return message
}


onMounted(() => {
    if (!smilestore.data.arc) {
        smilestore.recordProperty('arc', {}); // Initialize arc as an empty object
    }
    // add event listener that warns the user if they try to refresh the page
    window.addEventListener('beforeunload', (event) => {
        smilestore.recordWindowEvent('beforeunload', { description: `User attempted to leave the page on task ${taskIndex}` })
        smilestore.saveData(true)
        beforeUnloadHandler(event)
    })
    // experiment variables
    arcData = [];

    // load file names from ARC/fileNames.json
    gridsList = fileNames;

    // task variables
    MAX_TASKS = 5;
    NUM_TASKS = gridsList.length;
    tutorialGrid = Array("e9afcf9a.json");
    taskList = [];
    tutorialTask = [];
    taskIndex = 0;
    // get grids from condition
    grids = getGridsFromCond();

    // console.log(smilestore.data)

    // internal state variables
    CURRENT_INPUT_GRID = new Grid(3, 3);
    CURRENT_OUTPUT_GRID = new Grid(3, 3);
    TEST_PAIRS = [];
    CURRENT_TEST_PAIR_INDEX = 0;
    SELECT_DATA = [];
    COPY_PASTE_DATA = [];
    IS_TUTORIAL = true;
    IS_WRITING_SOLUTION = false;
    IS_FIRST_WRITTEN = true;
    FIRST_WRITTEN_SOLUTION = "";
    LAST_WRITTEN_SOLUTION = "";
    FEEDBACK = "";
    PREV_OUTPUT_GRID = "";

    // cosmetics
    EDITION_GRID_HEIGHT = 400;
    EDITION_GRID_WIDTH = 400;
    MAX_CELL_SIZE = 100;

    // global information
    prevTask = "None";
    taskName = "";
    numAttempts = 1;
    numActions = 0;
    maxNumAttempts = 3;
    solved = false;
    toolBar = document.getElementById("editor_grid_control_btns");
    undoStack = [];

    const currentView = new ARC_Experiment();
});

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', beforeUnloadHandler)
});

</script>

<template>
    <div class="page">
        <div id="container-exp">
            <div id="trial">
                <!-- <div id="modal_bg"> -->
                <!--   <div id="modal"> -->
                <!--     <div>Welcome to the ARC testing interface. In this experiment, you will complete a series of abstract reasoning puzzles. Press the Start button to begin the tutorial. <br></div> -->
                <!--     <br /> -->
                <!--     <\!-- <input type="file" class="load_task"/> -\-> -->
                <!--     <button onclick="showSlides()" id="start_tutorial_btn">Start Tutorial</button> -->
                <!--     <button onclick="startExperiment()" id="start_experiment_btn">Start Experiment</button> -->
                <!--     <\!-- <button onclick="firstTask()" id="random_task_btn">First task</button> -\-> -->
                <!--     <\!-- <button onclick="randomTask()" id="random_task_btn">Random task</button> -\-> -->
                <!--   </div> -->
                <!-- </div> -->
                <div id="tutorial_container">
                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (1/12)<br /><br /></div>
                        <div>
                            In this experiment, you will complete a number of different tasks involving
                            a series of colored rectangular grids. In each task, you will be presented
                            with a limited number of <strong>example input and output pairs</strong>,
                            like the ones shown below. Each input is transformed by a machine that
                            applies a <strong>hidden rule</strong> to produce a corresponding output.<br />
                        </div>
                        <br />
                        <div class="tutorial_pair">
                            <img src="/example-input-one-eval.png" width="200" />
                            <div id="computer_arrow">
                                <div id="comp">
                                    <img src="/comp-eval.svg" id="comp_inner" width="100" height="100" />
                                </div>
                                <div id="arrow">
                                    <img src="/arrow-eval.svg" id="arrow_inner" width="50" height="50" />
                                </div>
                            </div>
                            <img src="/example-output-one-eval.png" width="200" />
                        </div>

                        <div class="tutorial_pair">
                            <img src="/example-input-two-eval.png" width="200" />
                            <div id="computer_arrow">
                                <div id="comp">
                                    <img src="/comp-eval.svg" id="comp_inner" width="100" height="100" />
                                </div>
                                <div id="arrow">
                                    <img src="/arrow-eval.svg" id="arrow_inner" width="50" height="50" />
                                </div>
                            </div>
                            <img src="/example-output-two-eval.png" width="200" />
                        </div>
                    </div>
                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (2/12)<br /><br /></div>
                        <div>
                            For each task, you will be provided with a new <strong>Test Input</strong>,
                            and your goal in this experiment is to guess what the correct
                            <strong>Test Output</strong> should be, based on the examples shown and what
                            you think the hidden rule for that given task is.<br />
                        </div>
                        <br />
                        <div class="tutorial_pair">
                            <img src="/test-input-eval.png" width="200" />
                            <div id="computer_arrow">
                                <div id="comp">
                                    <img src="/comp-eval.svg" id="comp_inner" width="100" height="100" />
                                </div>
                                <div id="arrow">
                                    <img src="/arrow-eval.svg" id="arrow_inner" width="50" height="50" />
                                </div>
                            </div>
                            <img src="/blank-grid-eval.png" width="200" />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (3/12)<br /><br /></div>
                        <div>
                            For this example, the particular rule is to create a checkerboard pattern by alternating
                            between the two colors in each row, starting with the first color of each row as seen in the
                            input
                            grid. The rule will change
                            from task to task, so you will need to look at the examples to discover the
                            rule for each task.<br />
                        </div>
                        <br />
                        <div class="tutorial_pair">
                            <img src="/test-input-eval.png" width="200" />
                            <div id="computer_arrow">
                                <div id="comp">
                                    <img src="/comp-eval.svg" id="comp_inner" width="100" height="100" />
                                </div>
                                <div id="arrow">
                                    <img src="/arrow-eval.svg" id="arrow_inner" width="50" height="50" />
                                </div>
                            </div>
                            <img src="/test-output-eval.png" width="200" />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (4/12)<br /><br /></div>
                        <div>
                            Below is an image of the interface that you will be using to solve these
                            tasks. The example pairs will be shown on the left, the Test Input in the
                            middle and the current Test Ouptut on the right. The set of tools to
                            manipulate the Test Output are on the bottom right, and we will go through
                            these tools one by one, and show you how to produce the Test Output for this
                            example task.<br />
                        </div>
                        <br />
                        <div class="tutorial_pair">
                            <img src="/arc-interface-eval.png" width="900" />
                        </div>
                    </div>
                    <br />

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (5/12)<br /><br /></div>
                        <div>
                            In the clip below, we demonstrate <strong>changing the Grid Size</strong> of
                            the Test Output from 3x3 to 2x6, followed by the
                            <strong>Copy from Input</strong> button, which copies the test input to the
                            test output (and automatically resizes the grid). Additionally, if you want to start over,
                            you can always press
                            the <strong>Reset Grid</strong> button to reset to a blank 3x3 grid.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/resize-and-copy-from-input-eval.mp4" width="800" type="video/mp4" controls
                                playsinline autoplay muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (6/12)<br /><br /></div>
                        <div>
                            In the clip below, we show how to use the <strong>Edit Tool</strong> to
                            modify the test output grid one square at a time. You can change colors by
                            clicking on one of the ten different colors under the
                            <strong>Select Color</strong> section.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/edit-tool-eval.mp4" width="800" type="video/mp4" controls playsinline autoplay
                                muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (7/12)<br /><br /></div>
                        <div>
                            In the clip below, we show how to use the <strong>Select Tool</strong> to
                            first select multiple cells by clicking and dragging, and then changing
                            their color.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/select-change-color-eval.mp4" width="800" type="video/mp4" controls playsinline
                                autoplay muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (8/12)<br /><br /></div>
                        <div>
                            In the clip below, we show how you can also use the
                            <strong>Select Tool</strong> to <strong>Copy</strong> (by pressing C after
                            selection) and to <strong>Paste</strong> at a location (by pressing V). You can copy from
                            both the test input grid and the test output.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/select-copy-paste-eval.mp4" width="800" type="video/mp4" controls playsinline
                                autoplay muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (9/12)<br /><br /></div>
                        <div>
                            In the clip below, we show how to use the
                            <strong>Flood Fill Tool</strong> to change the color of connected regions.
                            <br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/flood-fill-eval.mp4" width="800" type="video/mp4" controls playsinline autoplay
                                muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (10/12)<br /><br /></div>
                        <div>
                            In the clip below, we show how you can use the <strong>Undo</strong> button
                            to revert an action you have done.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/undo-eval.mp4" width="800" type="video/mp4" controls playsinline autoplay muted
                                loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (11/12)<br /><br /></div>
                        <div>
                            Finally, when you think you have the correct solution, press the Submit
                            button as shown below. You will have
                            <strong>three attempts for each task </strong>before moving onto the next
                            one, and there will be <strong>five tasks in total.</strong> There is
                            <strong> no time limit for completing each task</strong>. It
                            will likely take around 30 minutes to complete the experiment but you are given a total of
                            <strong>90 minutes</strong>.
                            The next screen will take
                            you to the tutorial interface, where you will attempt to recreate the
                            solution for this example task, before proceeding to the main experiment.<br />
                        </div>
                        <br />
                        <div class="tutorial_video">
                            <video src="/submit-eval.mp4" width="800" type="video/mp4" controls playsinline autoplay
                                muted loop />
                        </div>
                    </div>

                    <div class="tutorial_slide">
                        <div><strong>ARC Tutorial</strong> (12/12)<br /><br /></div>
                        <div>
                            <p>
                                <strong>WARNING!</strong>
                            </p>

                            If you refresh the experiment, you will be taken back to the beginning of
                            the experiment. This will break the flow of the experiment and you may not
                            be able to finish the experiment. Furthermore, your data will
                            not be saved and your compensation will be reduced depending on how many tasks you have
                            completed.
                        </div>
                    </div>

                    <a class="prev" @click="plusSlides(-1)">&#10094;</a>
                    <a class="next" @click="plusSlides(1)">&#10095;</a>
                </div>

                <div id="tutorial_nav" style="text-align: center">
                    <span class="dot" @click="currentSlide(0)"></span>
                    <span class="dot" @click="currentSlide(1)"></span>
                    <span class="dot" @click="currentSlide(2)"></span>
                    <span class="dot" @click="currentSlide(3)"></span>
                    <span class="dot" @click="currentSlide(4)"></span>
                    <span class="dot" @click="currentSlide(5)"></span>
                    <span class="dot" @click="currentSlide(6)"></span>
                    <span class="dot" @click="currentSlide(7)"></span>
                    <span class="dot" @click="currentSlide(8)"></span>
                    <span class="dot" @click="currentSlide(9)"></span>
                    <span class="dot" @click="currentSlide(10)"></span>
                    <span class="dot" @click="currentSlide(11)"></span>
                </div>

                <div id="workspace">
                    <div id="demonstration_examples_view">
                        <div class="text" id="task_demo_header">Task Demonstration</div>
                        <div id="task_preview"></div>
                    </div>

                    <div id="evaluation_view">
                        <div id="parent_load_task_control_btns">
                            <div id="load_task_control_btns">
                                <div class="text" id="current_task">
                                    <span></span>
                                    <div id="info_display"></div>
                                </div>
                            </div>
                        </div>
                        <div id="evaluation-input-view">
                            <div class="text" id="test_input_header">Test Input</div>
                            <div id="evaluation_input" class="selectable_grid"></div>
                        </div>

                        <div id="evaluation_output_editor">
                            <div class="text" id="test_output_header">Test Output</div>
                            <div id="output_grid">
                                <div class="edition_grid selectable_grid" id="editor">
                                    <div class="row">
                                        <div class="cell" symbol="0" x="0" y="0"></div>
                                        <div class="cell" symbol="0" x="0" y="1"></div>
                                        <div class="cell" symbol="0" x="0" y="2"></div>
                                    </div>
                                    <div class="row">
                                        <div class="cell" symbol="0" x="1" y="0"></div>
                                        <div class="cell" symbol="0" x="1" y="1"></div>
                                        <div class="cell" symbol="0" x="1" y="2"></div>
                                    </div>
                                    <div class="row">
                                        <div class="cell" symbol="0" x="2" y="0"></div>
                                        <div class="cell" symbol="0" x="2" y="1"></div>
                                        <div class="cell" symbol="0" x="2" y="2"></div>
                                    </div>
                                </div>
                            </div>

                            <div id="edition_view">
                                <div id="write_solution" style="display: none">
                                    <p id="write_solution_text">
                                        Congratulations, you solved the tutorial task! In the main experiment,
                                        after either solving the task, or three incorrect attempts you will be
                                        asked to write a description of your solution in the text box below.
                                        For this tutorial please write the following solution to this task:
                                        <strong>Create a checkerboard pattern by alternating
                                            between the two colors in each row.</strong>
                                        You will only advance to the experiment if you fill this in exactly.
                                        This solution is approximately the length and generality we hope for
                                        in your responses. When you are done, please press the Submit button
                                        to continue.
                                    </p>
                                    <form>
                                        <textarea id="write_solution_box"></textarea>
                                    </form>
                                    <br />
                                    <!-- <button onclick="startExperiment()" id="submit_description_btn">Submit and begin the experiment</button> -->
                                    <button @click="firstDescription()" id="submit_first_description_btn">
                                        Submit
                                    </button>
                                    <button @click="nextTask()" id="submit_description_btn">Submit</button>
                                    <button @click="finishTutorial()" id="submit_tutorial_description_btn">
                                        Submit
                                    </button>
                                </div>
                                <div id="editor_grid_control_btns">
                                    <div id="toolbar">
                                        <div>
                                            <label_heading for="edit" id="toolbar_heading">Select Tool</label_heading>
                                            <br />
                                            <input type="radio" id="tool_edit" name="tool_switching" value="edit"
                                                checked />
                                            <label for="tool_edit" class="tool"><strong>Edit</strong>: Modify one cell
                                                at a
                                                time</label>
                                            <br />
                                            <input type="radio" id="tool_select" name="tool_switching" value="select" />
                                            <label for="tool_select" class="tool"><strong>Select</strong>: Select
                                                multiple
                                                cells to modify</label>
                                            <br />
                                            <input type="radio" id="tool_floodfill" name="tool_switching"
                                                value="floodfill" />
                                            <label for="tool_floodfill" class="tool"><strong>Flood Fill</strong>: Change
                                                connected areas to another
                                                color</label>
                                            <br />
                                        </div>
                                    </div>

                                    <label_heading for="edit" id="toolbar_heading">Select Color</label_heading>
                                    <br />
                                    <div id="symbol_picker" class="is-centered">
                                        <div id="selected_first" class="symbol_preview symbol_0 selected" symbol="0">
                                        </div>
                                        <div class="symbol_preview symbol_1" symbol="1"></div>
                                        <div class="symbol_preview symbol_2" symbol="2"></div>
                                        <div class="symbol_preview symbol_3" symbol="3"></div>
                                        <div class="symbol_preview symbol_4" symbol="4"></div>
                                        <div class="symbol_preview symbol_5" symbol="5"></div>
                                        <div class="symbol_preview symbol_6" symbol="6"></div>
                                        <div class="symbol_preview symbol_7" symbol="7"></div>
                                        <div class="symbol_preview symbol_8" symbol="8"></div>
                                        <div class="symbol_preview symbol_9" symbol="9"></div>
                                    </div>

                                    <div id="resize_control_btns">
                                        <label_heading for="edit" id="toolbar_heading">Grid Size</label_heading>
                                        <!-- <label for="output_grid_size">Change grid size: </label> -->
                                        <label for="height">Height</label>
                                        <select id="height">
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3" Selected>3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                            <option value="6">6</option>
                                            <option value="7">7</option>
                                            <option value="8">8</option>
                                            <option value="9">9</option>
                                            <option value="10">10</option>
                                            <option value="11">11</option>
                                            <option value="12">12</option>
                                            <option value="13">13</option>
                                            <option value="14">14</option>
                                            <option value="15">15</option>
                                            <option value="16">16</option>
                                            <option value="17">17</option>
                                            <option value="18">18</option>
                                            <option value="19">19</option>
                                            <option value="20">20</option>
                                            <option value="21">21</option>
                                            <option value="22">22</option>
                                            <option value="23">23</option>
                                            <option value="24">24</option>
                                            <option value="25">25</option>
                                            <option value="26">26</option>
                                            <option value="27">27</option>
                                            <option value="28">28</option>
                                            <option value="29">29</option>
                                            <option value="30">30</option>
                                        </select>
                                        <label for="width">Width</label>
                                        <select id="width">
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3" Selected>3</option>
                                            <option value="4">4</option>
                                            <option value="5">5</option>
                                            <option value="6">6</option>
                                            <option value="7">7</option>
                                            <option value="8">8</option>
                                            <option value="9">9</option>
                                            <option value="10">10</option>
                                            <option value="11">11</option>
                                            <option value="12">12</option>
                                            <option value="13">13</option>
                                            <option value="14">14</option>
                                            <option value="15">15</option>
                                            <option value="16">16</option>
                                            <option value="17">17</option>
                                            <option value="18">18</option>
                                            <option value="19">19</option>
                                            <option value="20">20</option>
                                            <option value="21">21</option>
                                            <option value="22">22</option>
                                            <option value="23">23</option>
                                            <option value="24">24</option>
                                            <option value="25">25</option>
                                            <option value="26">26</option>
                                            <option value="27">27</option>
                                            <option value="28">28</option>
                                            <option value="29">29</option>
                                            <option value="30">30</option>
                                        </select>
                                        <br />
                                    </div>

                                    <button @click="copyFromInput()" id="copy_from_input_btn">
                                        Copy from Input
                                    </button>
                                    <button @click="resetOutputGrid()">Reset Grid</button>
                                    <button @click="showHelpModal()">Help</button>
                                    <button @click="undo()">Undo</button>
                                    <br />
                                    <button @click="submitTutorial()" id="submit_tutorial_solution_btn">
                                        Submit
                                    </button>
                                    <button @click="submitSolution()" id="submit_solution_btn">
                                        Submit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="tutorial_quiz">
                    <div class="tutorial_text">
                        <div>
                            <strong>Before you begin the main experiment, we have a few more questions to
                                check your understanding of the task. You will need to answer them all
                                correctly in order to continue.</strong>
                        </div>
                    </div>

                    <div class="tutorial_text">
                        <div><strong>Are any of the tasks timed?</strong></div>
                        <br />
                        <form>
                            <div>
                                <input type="radio" id="yes" name="y/n" value="yes" checked />
                                <label for="yes">Yes</label>

                                <input type="radio" id="no" name="y/n" value="no" />
                                <label for="no">No</label>
                            </div>
                        </form>
                    </div>

                    <div class="tutorial_text">
                        <div>
                            <strong>How many attempts do you have before you will be moved onto the next
                                task?</strong>
                        </div>
                        <div>
                            <br />
                            <label for="attempts_question">Number of attempts:</label>
                            <select id="attempts_question">
                                <option value="1" Selected>1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                            </select>
                        </div>
                    </div>

                    <div class="tutorial_text">
                        <div><strong>How many tasks in total are there?</strong></div>
                        <div>
                            <br />
                            <label for="tasks_question">Number of tasks:</label>
                            <select id="tasks_question">
                                <option value="1" Selected>1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                            </select>
                        </div>
                    </div>

                    <div class="tutorial_text">
                        <div>
                            <strong>Finally, we will randomly sample one of your tasks to check for accuracy
                                and description quality. You will be awarded a one dollar bonus if it is
                                answered correctly within three attempts and the description is of the
                                quality outlined in the tutorial.</strong>
                        </div>

                        <div>
                            <br />
                            <label for="bonus_question">How many tasks will we randomly sample to award a bonus?</label>
                            <select id="bonus_question">
                                <option value="1" Selected>1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                            </select>
                        </div>
                    </div>

                    <div class="tutorial_text">
                        <button @click="evalAnswers()" id="tutorial_quiz_btn">Submit</button>
                    </div>

                    <div id="incorrect_submission">
                        <div>One or more answers were incorrect, please try again.</div>
                    </div>

                    <div id="correct_submission">
                        <div>
                            You have correctly answered all of the questions! You will now begin the
                            experiment.
                        </div>
                    </div>
                </div>

                <div id="experiment_finish">
                    <div class="tutorial_text">
                        <div>
                            Congratulations, you have completed the experiment! Please provide some
                            feedback in the box below. We are especially interested in the strategies
                            you used to solve these problems. Click the <strong>Submit</strong> button
                            to finish and submit your results to us. You can only complete the
                            experiment if you provide feedback. Thanks!
                        </div>
                        <br />
                        <form>
                            <textarea id="feedback_box"></textarea>
                        </form>
                        <br />
                        <button @click="submitResults()" id="submit_feedback_btn">Submit</button>
                    </div>
                </div>

                <div id="help_modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <span class="close">&times;</span>
                            <h3>Help</h3>
                        </div>
                        <div class="modal-body">
                            <p>
                                In this experiment, we are looking at your ability to solve abstract
                                reasoning puzzles. On the left in the
                                <strong>Task Demonstration</strong> panel, there are a limited number of
                                <strong>Example Input</strong> and <strong>Example output</strong> pairs
                                for the current task. Your goal is to determine what the underlying rule
                                is based on these pairs, and apply it to a new
                                <strong>Test Input</strong> to produce the correct
                                <strong>Test Output</strong>. For each task, you will have three attempts
                                to submit your response before moving onto the next task, and there are
                                five tasks in total. You have as much time as necessary to solve each
                                task.
                            </p>
                            <p>
                                To solve each task, there are a number of different tools you can use:
                            </p>
                            <ul>
                                <li>
                                    The <strong>Edit</strong> tool lets you edit each cell one by one by
                                    clicking on each cell separately. You can also click and drag your mouse
                                    down to edit multiple cells one by one.
                                </li>
                                <li>
                                    The <strong>Select</strong> tool lets you edit multiple cells at the
                                    same time. Click and drag to select a rectangular block of cells, which
                                    will now be shaded. Then you can change the color of all of the selected
                                    cells by selecting a different color in the
                                    <strong>Select Color</strong> palette. Alternatively, you can
                                    <strong>Copy</strong> the cells by first pressing C, and
                                    <strong>Paste</strong> the cells in another location by selecting a
                                    single cell and pressing V.
                                </li>
                                <li>
                                    The <strong>Flood Fill</strong> tool is like a paint bucket, it will
                                    fill in any connected cells (of the same color) to the one you click on
                                    with the same new color. To use this, first select the color you want
                                    using the <strong>Select Color</strong> palette, and click on a single
                                    cell with this tool.
                                </li>

                                <li>
                                    The current color is indicated by the color with an orange border in the
                                    <strong>Select Color</strong> palette. Clicking on another color will
                                    change the current color.
                                </li>
                                <li>
                                    To change the height or width of the <strong>Test Output</strong>, click
                                    on their respective dropdown menus to select the new height or width in
                                    the <strong>Grid Size</strong> options.
                                </li>
                            </ul>
                            <p>
                                There are a few additional buttons at the bottom that provide additional
                                functionality:
                            </p>
                            <ul>
                                <li>
                                    The <strong>Copy from Input</strong> button will copy the current
                                    <strong>Test Input</strong> to the <strong>Test Output</strong>.
                                </li>
                                <li>
                                    In case you want to start from scratch, the
                                    <strong>Reset</strong> button will clear the current
                                    <strong>Test Output</strong> grid to a blank 3x3 grid.
                                </li>
                                <li>
                                    If you want to read these instructions at a later time, press the
                                    <Strong>Help</Strong> button again.
                                </li>
                            </ul>
                            <p>
                                Finally, if you think you have the correct output, press the
                                <strong>Submit</strong> button! You have three attempts to get each task
                                right.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- <button class="button is-success is-light" id='finish' @click="finish(next())">next &nbsp;<FAIcon icon="fa-solid fa-arrow-right" /></button> -->
</template>

<style>
body {
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica,
        Arial;
    font-weight: 300;
    font-size: 20px;
    min-width: 1440px;
}

/*background used to be #d5d5d5 -- changing it to white #FFFFFF*/

#current_task {
    text-align: center;
    margin-top: 2px;
    margin-left: 10px;
    height: 40px;
    font-size: 18px;
}

#tutorial_container {
    /* width: 1430px; */
    width: 100%;
    float: left;
    display: none;
    background-color: white;
    overflow: hidden;
    positive: relative;
    /* margin: auto; */
    /* margin-left: auto; */
    /* margin-right: auto; */
    /* display: block; */
}

#workspace {
    /* width: 1430px; */
    width: 100%;
    float: left;
    font-size: 16px;
    /* margin-left: auto; */
    /* margin-right: auto; */
    /* display: block; */
}

#demonstration_examples_view {
    border-radius: 10px;
    float: left;
    width: 430px;
    /* height: 800px; */
    margin: 10px;
    margin-bottom: 10px;
    /* margin-right: 5px; */
    background-color: #d5d5d5;
}

#evaluation_view {
    border-radius: 10px;
    float: left;
    width: 960px;
    margin: 10px;
    margin-left: 5px;
    background-color: #d5d5d5;
    /* min-height: 850px; */
}

#evaluation-input-view {
    float: left;
    width: 400px;
    margin: 10px;
}

#evaluation_input {
    display: flex;
    justify-content: top;
    align-items: center;
    flex-direction: column;
}

#evaluation_output_editor {
    float: left;
    width: 530px;
    margin-top: 10px;
    /* margin-bottom: 10px; */
}

#parent_load_control_btns {
    text-align: center;
    align-items: center;
    align-content: center;
}

#load_task_control_btns {
    float: left;
    margin-top: 10px;
    margin-bottom: 0;
    margin-left: 10px;
    margin-right: 10px;
    background: white;
    width: 940px;
    /* padding-top: 5px; */
    padding-bottom: 5px;
    align-self: center;
    text-align: center;
    vertical-align: middle;
    display: inline-block;
    align-items: right;
    border-radius: 6px;
}

#output_grid {
    display: flex;
    justify-content: center;
}

#write_solution {
    font-size: 18px;
    /* text-align: justify; */
    text-justify: auto;
    float: left;
    margin-top: 10px;
    margin-bottom: 10px;
    background: white;
    width: 510px;
    padding-left: 10px;
    padding-right: 10px;
    border-radius: 6px;
}

#write_solution_box {
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica,
        Arial;
    font-size: 16px;
    width: 100%;
    height: 100px;
    padding: 5px;
    box-sizing: border-box;
    border: 2px solid #ccc;
    border-radius: 4px;
    background-color: #f8f8f8;
    font-size: 16px;
    resize: none;
}

#feedback_box {
    font-family: "HelveticaNeue-Light", "Helvetica Neue Light", "Helvetica Neue", Helvetica,
        Arial;
    font-size: 18px;
    width: 90%;
    height: 150px;
    padding: 5px;
    box-sizing: border-box;
    border: 2px solid #ccc;
    border-radius: 4px;
    background-color: #f8f8f8;
    resize: none;
}

#editor_grid_control_btns {
    float: left;
    margin-top: 10px;
    margin-bottom: 10px;
    background: white;
    width: 100%;
    padding-top: 5px;
    padding-bottom: 5px;
    border-radius: 6px;
}

#resize_control_btns {
    width: 100%;
    float: left;
    margin-bottom: 10px;
}

#submit_solution_btn {
    color: white;
    border-radius: 8px;
    /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); */
    background: rgb(28, 184, 65);
    float: center;
    margin-right: 8px;
    margin-top: 4px;
}

#submit_solution_btn:active {
    background: rgb(0, 78, 0);
}

button:focus {
    outline: 0;
}

#submit_description_btn {
    color: white;
    border-radius: 8px;
    /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); */
    background: rgb(28, 184, 65);
    float: center;
    /* margin-right: 8px; */
    margin-top: 2px;
    margin-bottom: 10px;
}

#submit_description_btn:active {
    background: rgb(0, 78, 0);
}

#submit_tutorial_solution_btn {
    color: white;
    border-radius: 8px;
    /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); */
    background: rgb(28, 184, 65);
    float: center;
    margin-right: 8px;
    margin-top: 4px;
}

#submit_tutorial_solution_btn:active {
    background: rgb(0, 78, 0);
}

button:focus {
    outline: 0;
}

#submit_first_description_btn {
    color: white;
    border-radius: 8px;
    /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); */
    background: rgb(28, 184, 65);
    float: center;
    /* margin-right: 8px; */
    margin-top: 2px;
}

#submit_first_description_btn:active {
    background: rgb(0, 78, 0);
}

#submit_tutorial_description_btn {
    color: white;
    border-radius: 8px;
    /* text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2); */
    background: rgb(28, 184, 65);
    float: center;
    /* margin-right: 8px; */
    margin-top: 0px;
    margin-bottom: 10px;
}

#submit_tutorial_ description_btn:active {
    background: rgb(0, 78, 0);
}

#toolbar {
    float: left;
    /* background: white; */
    /* margin-left: 10px; */
    /* margin-top: 10px; */
    margin-bottom: 10px;
    width: 100%;
}

#symbol_picker {
    float: left;
    /* background: white; */
    margin-left: 165px;
    margin-bottom: 20px;
    width: 100%;
}

.symbol_preview {
    width: 25px;
    height: 25px;
    float: left;
}

label_heading {
    font-weight: bold;
    margin-left: 10px;
}

label {
    /* font-weight: bold; */
    font-size: 18px;
    margin-left: 10px;
}

#incorrect_submission {
    margin: auto;
    background-color: white;
    text-align: center;
    vertical-align: top;
    width: 650px;
    margin-top: 50px;
    color: red;
    visibility: hidden;
}

#correct_submission {
    margin: auto;
    background-color: white;
    text-align: center;
    vertical-align: top;
    width: 650px;
    margin-top: 50px;
    color: green;
    visibility: hidden;
}

input,
button {
    font-size: 18px;
    /* font-weight: 600; */

    /* default for <button>, but useful for <a> */
    display: inline-block;
    text-align: center;
    text-decoration: none;

    /* create a small space when buttons wrap on 2 lines */
    margin: 2px 0;

    /* invisible border (will be colored on hover/focus) */
    border: solid 1px transparent;
    border-radius: 8px;

    /* size comes from text & padding (no width/height) */
    padding: 0.5em 1em;

    /* make sure colors have enough contrast! */
    color: #ffffff;
    background-color: #0074d9;

    margin-left: 10px;
    /* border-radius: 5px; */
    /* border-width: 1px; */
    /* border-color: black; */
    /* color: white; */
    /* background-color: white; */
    padding-top: 4px;
    padding-bottom: 4px;
    padding-left: 12px;
    padding-right: 12px;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

button:active {
    transform: translateY(1px);
    filter: saturate(150%);
    background: #004b8d;
}

/* inverse colors on mouse-over and focus */
button:hover,
button:focus {
    /* color: #0074D9; */
    /* border-color: currentColor; */
    /* background-color: white; */
    outline: none;
    box-shadow: 0 0 0 3px #74beff, 0 0 0 1.5px #74beff;
}

#resize_btn {
    margin-left: 0;
}

/*Task demonstration*/

.pair_preview {
    height: 230px;
    padding: 10px;
    /* border-bottom: solid 1px #a1a1a1; */
}

.input_preview {
    height: 200px;
    width: 200px;
    display: flex;
    justify-content: top;
    align-items: center;
    flex-direction: column;
}

.output_preview {
    height: 200px;
    width: 200px;
    /* float: center; */
    margin-left: 10px;
    margin-right: 10px;
    display: flex;
    justify-content: top;
    align-items: center;
    flex-direction: column;
}

.preview_block {
    height: 200px;
    width: 200px;
    float: left;
    margin-bottom: 60px;
}

.text {
    text-align: center;
    background: white;
    padding-top: 5px;
    padding-bottom: 5px;
    margin-bottom: 10px;
}

.subTextLeft {
    text-align: center;
    /* background: white; */
    padding-top: 5px;
    padding-bottom: 5px;
}

.subTextRight {
    width: 200px;
    text-align: center;
    /* background: white; */
    padding-top: 5px;
    padding-bottom: 5px;
    /* float: right; */
    margin-left: 10px;
}

#task_demo_header {
    margin-top: 10px;
    margin-left: 10px;
    margin-right: 10px;
    margin-bottom: 0px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 18px;
}

#test_input_header {
    /* margin: 10px; */
    border-radius: 6px;
    font-weight: bold;
}

#test_output_header {
    /* margin: 10px; */
    border-radius: 6px;
    font-weight: bold;
}

#computer_arrow {
    display: inline-block;
}

#arrow_inner {
    position: relative;
    margin-bottom: 20px;
}

.tutorial_pair {
    text-align: center;
    padding-top: 20px;
}

.tutorial_slide {
    margin: auto;
    background-color: white;
    /* text-align: center; */
    width: 900px;
    /* height: 500px; */
    margin-top: 20px;
}

.tutorial_text {
    margin: auto;
    background-color: white;
    text-align: center;
    vertical-align: top;
    width: 1000px;
    margin-top: 50px;
}

.demographic_text {
    margin: auto;
    background-color: white;
    text-align: left;
    vertical-align: top;
    width: 5000px;
    margin-top: 10px;
}

.tutorial_video {
    margin: auto;
    background-color: white;
    text-align: center;
    vertical-align: top;
    margin-top: 20px;
}

#modal_bg {
    background-color: black;
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
}

#modal {
    margin: auto;
    background-color: white;
    text-align: center;
    padding: 100px;
    width: 500px;
    margin-top: 100px;
}

/* #tutorial { */
/*     display: none; */
/*     margin: auto; */
/*     background-color: white; */
/*     text-align: center; */
/*     vertical-align: top; */
/*     width: 500px; */
/*     margin-top: 50px; */
/* } */

#modal input {
    margin-left: 70px;
}

br {
    display: block;
    margin: 10px 0;
}

#task_header {
    background-color: white;
    margin-top: 10px;
    margin-bottom: 10px;
    border-radius: 6px;
    font-weight: bold;
}

#info_display {
    font-size: 18px;
    margin-top: 5px;
    margin-bottom: 5px;
    margin-left: 0px;
}

/* Next & previous buttons */
.prev,
.next {
    cursor: pointer;
    position: absolute;
    top: 50%;
    width: auto;
    margin-top: -22px;
    padding: 16px;
    color: black;
    font-weight: bold;
    font-size: 18px;
    transition: 0.6s ease;
    /* border-radius: 0 3px 3px 0; */
    user-select: none;
}

/* Postion the "prev button" to the left */
.prev {
    left: 0;
}

/* Position the "next button" to the right */
.next {
    right: 0;
    border-radius: 3px 0 0 3px;
}

/* On hover, add a black background color with a little bit see-through */
.prev:hover,
.next:hover {
    background-color: rgba(0, 0, 0, 0.2);
}

#tutorial_nav {
    position: fixed;
    bottom: 0px;
    width: 100%;
    padding-bottom: 20px;
}

/* The dots/bullets/indicators */
.dot {
    cursor: pointer;
    height: 15px;
    width: 15px;
    margin: 0 2px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;
    transition: background-color 0.6s ease;
}

.active,
.dot:hover {
    background-color: #717171;
}

.tool {
    margin-left: 3px;
}

label_heading {
    font-size: 18px;
    margin-bottom: 5px;
}

/* help modal */
/* The Modal (background) */
#help_modal {
    display: none;
    /* Hidden by default */
    position: fixed;
    /* Stay in place */
    z-index: 1;
    /* Sit on top */
    left: 0;
    top: 0;
    width: 100%;
    /* Full width */
    height: 100%;
    /* Full height */
    overflow: auto;
    /* Enable scroll if needed */
    background-color: rgb(0, 0, 0);
    /* Fallback color */
    background-color: rgba(0, 0, 0, 0.4);
    /* Black w/ opacity */
}

/* The Close Button */
.close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
}

.close:hover,
.close:focus {
    color: white;
    text-decoration: none;
    cursor: pointer;
}

/* Modal Header */
.modal-header {
    padding: 2px 16px;
    background-color: #0074d9;
    color: white;
    text-align: center;
}

/* Modal Body */
.modal-body {
    padding: 2px 16px;
}

/* Modal Footer */
.modal-footer {
    padding: 2px 16px;
    background-color: #0074d9;
    color: white;
}

/* Modal Content */
.modal-content {
    position: relative;
    background-color: white;
    margin: 2% auto;
    /* 15% from the top and centered */
    padding: 0;
    /* border: 1px solid #0074D9; */
    width: 90%;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
    /* animation-name: animatetop; */
    /* animation-duration: 0.4s; */
}

/*changed cell background from white to grey*/
.cell {
    width: 100px;
    height: 100px;
    /*    border-left: 1px solid #ffffff;
    border-top: 1px solid #ffffff;*/
    border-left: 1px solid #808080;
    border-top: 1px solid #808080;
    float: left;
    background-color: #808080;
}

.row {
    clear: both;
}

.symbol_0 {
    background-color: #000;
}

.symbol_1 {
    background-color: #0074d9;
    /* blue */
}

.symbol_2 {
    background-color: #ff4136;
    /* red */
}

.symbol_3 {
    background-color: #2ecc40;
    /* green */
}

.symbol_4 {
    background-color: #ffdc00;
    /* yellow */
}

.symbol_5 {
    background-color: #aaaaaa;
    /* grey */
}

.symbol_6 {
    background-color: #f012be;
    /* fuschia */
}

.symbol_7 {
    background-color: #ff851b;
    /* orange */
}

.symbol_8 {
    background-color: #7fdbff;
    /* teal */
}

.symbol_9 {
    background-color: #870c25;
    /* brown */
}

/*Symbol picker*/

.symbol_preview {
    width: 20px;
    height: 20px;
    float: left;
}

.grid_size_field {
    width: 50px;
}

.selected-symbol-preview {
    border: 2px solid orange;
}

/*Selectable*/

.ui-selected {
    background-image: url(/black-twill.png), url(/brushed-alum.png);
}

.ui-selectable-helper {
    border: 1px dotted #ddd;
    position: absolute;
    z-index: 1000;
}

/*Message display*/

#error_display {
    color: red;
    width: 100%;
    float: left;
    font-size: 14px;
    margin: 20px;
}

#info_display {
    color: green;
    width: 100%;
    float: left;
    font-size: 14px;
    margin: 20px;
}

#num_attempts {
    float: left;
    font-size: 14px;
    margin-top: 20px;
    margin: 20px;
}

#help_text {
    float: left;
    margin-top: 20px;
}
</style>
