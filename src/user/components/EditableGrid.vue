<script setup>
import { defineProps, computed, ref, onMounted, watch } from 'vue';

const props = defineProps({
    gridInstance: {
        type: Object, // Expects a reactive Grid class instance { height, width, grid: [[...],...] }
        required: true,
    },
    isInteractive: {
        type: Boolean,
        default: false,
    },
    maxCellSize: {
        type: Number,
        default: 100,
    },
    containerWidth: { // For fitting cells, pass the available width for the grid
        type: Number,
        default: 400,
    },
    containerHeight: { // For fitting cells, pass the available height for the grid
        type: Number,
        default: 400,
    },
    allowSelect: {
        type: Boolean,
        default: false,
    },
    selectedCells: { // For displaying selection, e.g. Set of "x,y" strings
        type: Object, // Set
        default: () => new Set(),
    }
});

const emit = defineEmits(['cell-click', 'cell-mousedown', 'cell-mousemove', 'cell-mouseup', 'selection-change']);

const gridElementRef = ref(null);

const cellSize = computed(() => {
    if (!props.gridInstance || props.gridInstance.height === 0 || props.gridInstance.width === 0) {
        return props.maxCellSize;
    }
    const candidateHeight = Math.floor((props.containerHeight - props.gridInstance.height) / props.gridInstance.height);
    const candidateWidth = Math.floor((props.containerWidth - props.gridInstance.width) / props.gridInstance.width);
    let size = Math.min(candidateHeight, candidateWidth, props.maxCellSize);
    return Math.max(5, size); // Ensure a minimum size
});

const cellStyle = computed(() => ({
    width: `${cellSize.value}px`,
    height: `${cellSize.value}px`,
}));

// --- Selection Logic (Simplified example) ---
const isSelecting = ref(false);
const selectionStartCell = ref(null);
const currentSelectedCells = ref(new Set()); // Internal for drag

function getCellCoords(event) {
    const cellElement = event.target.closest('.cell');
    if (cellElement) {
        const x = parseInt(cellElement.dataset.x, 10);
        const y = parseInt(cellElement.dataset.y, 10);
        return { x, y };
    }
    return null;
}

function handleMouseDown(event) {
    if (!props.isInteractive) return;
    const coords = getCellCoords(event);
    if (coords) {
        emit('cell-mousedown', { ...coords, event });
        if (props.allowSelect) {
            isSelecting.value = true;
            selectionStartCell.value = coords;
            currentSelectedCells.value = new Set([`${coords.x},${coords.y}`]); // Start new selection
        }
    }
}

function handleMouseMove(event) {
    if (!props.isInteractive) return;
    const coords = getCellCoords(event);
    if (coords) {
        emit('cell-mousemove', { ...coords, event });
        if (props.allowSelect && isSelecting.value && selectionStartCell.value) {
            // Basic rectangular selection logic (can be improved)
            const tempSelected = new Set();
            const minX = Math.min(selectionStartCell.value.x, coords.x);
            const maxX = Math.max(selectionStartCell.value.x, coords.x);
            const minY = Math.min(selectionStartCell.value.y, coords.y);
            const maxY = Math.max(selectionStartCell.value.y, coords.y);
            for (let i = minX; i <= maxX; i++) {
                for (let j = minY; j <= maxY; j++) {
                    tempSelected.add(`${i},${j}`);
                }
            }
            currentSelectedCells.value = tempSelected;
        }
    }
}

function handleMouseUp(event) {
    if (!props.isInteractive) return;
    const coords = getCellCoords(event);
    if (coords) {
        emit('cell-mouseup', { ...coords, event });
    }
    if (props.allowSelect && isSelecting.value) {
        isSelecting.value = false;
        emit('selection-change', new Set(currentSelectedCells.value)); // Emit final selection
        // selectionStartCell.value = null; // Keep currentSelectedCells for visual until new selection starts
    }
}

function handleCellClick(event) {
    if (!props.isInteractive || (props.allowSelect && currentSelectedCells.value.size > 1)) {
        // If selection is active and multiple cells were part of drag, click might be handled by mouseup's selection-change
        // Or if not interactive, do nothing.
        return;
    }
    const coords = getCellCoords(event);
    if (coords) {
        emit('cell-click', { ...coords, event });
    }
}

function isCellSelected(x, y) {
    if (props.allowSelect) {
        return isSelecting.value ? currentSelectedCells.value.has(`${x},${y}`) : props.selectedCells.has(`${x},${y}`);
    }
    return false;
}

</script>

<template>
    <div class="grid-container" ref="gridElementRef" @mouseup="handleMouseUp"
        @mouseleave="props.allowSelect && isSelecting ? handleMouseUp($event) : null" <!-- Handle mouse leaving grid
        during selection -->
        <div v-if="!gridInstance || gridInstance.height === 0" class="empty-grid-placeholder">
            Grid not loaded or empty.
        </div>
        <div v-for="(row, rowIndex) in gridInstance.grid" :key="`row-${rowIndex}`" class="grid-row">
            <div v-for="(symbol, colIndex) in row" :key="`cell-${rowIndex}-${colIndex}`"
                :class="['cell', `symbol-${symbol}`, { 'interactive': isInteractive, 'selected': isCellSelected(rowIndex, colIndex) }]"
                :style="cellStyle" :data-x="rowIndex" :data-y="colIndex" :data-symbol="symbol" @click="handleCellClick"
                @mousedown="handleMouseDown" @mousemove="handleMouseMove
                ">
            </div>
        </div>
    </div>
</template>

<style scoped>
.grid-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Center rows if they don't fill width */
    border: 1px solid #ccc;
    user-select: none;
    /* Prevent text selection during drag */
}

.empty-grid-placeholder {
    padding: 20px;
    color: #777;
}

.grid-row {
    display: flex;
    /* Removed clear: both, flexbox handles layout */
}

.cell {
    border-left: 1px solid #808080;
    border-top: 1px solid #808080;
    background-color: #808080;
    /* Default for empty or symbol 0 if not styled */
    box-sizing: border-box;
}

.cell.interactive {
    cursor: pointer;
}

.cell:first-child {
    /* border-left: none; */
    /* If you want outer border only from container */
}

.grid-row:first-child .cell {
    /* border-top: none; */
    /* If you want outer border only from container */
}

.cell.selected {
    /* background-image: url(/black-twill.png), url(/brushed-alum.png); */
    /* Requires assets in public */
    background-color: rgba(0, 116, 217, 0.3);
    /* Example selection color */
    outline: 1px solid #0074D9;
}

/* Color definitions - ensure these match your original intent */
.symbol-0 {
    background-color: #000000;
}

/* Black */
.symbol-1 {
    background-color: #0074D9;
}

/* Blue */
.symbol-2 {
    background-color: #FF4136;
}

/* Red */
.symbol-3 {
    background-color: #2ECC40;
}

/* Green */
.symbol-4 {
    background-color: #FFDC00;
}

/* Yellow */
