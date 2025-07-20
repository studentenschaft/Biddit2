# Unified Academic Data Architecture

## Overview

This document describes the newly implemented unified academic data system that replaces the fragmented approach of multiple scorecard atoms and selectors. The system provides a single source of truth for all academic data while maintaining performance and consistency across StudyOverview and Transcript components.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│               UNIFIED DATA ORCHESTRATION ARCHITECTURE           │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   PRIMARY DATA ORCHESTRATOR                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              EventListContainer                         │     │
│  │                                                         │     │
│  │   ┌─────────────────────────────────────────────────┐   │     │
│  │   │           useEventListDataManager               │   │     │
│  │   │                                                 │   │     │
│  │   │  • useStudyPlanData     (fetches study plans) │   │     │
│  │   │  • useEnrolledCoursesData (fetches enrollments)│   │     │
│  │   │  • useCourseInfoData    (fetches course info)  │   │     │
│  │   │  • useCourseRatingsData (fetches ratings)     │   │     │
│  │   │  • useUnifiedCourseData (updates unified data) │   │     │
│  │   └─────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ (stores data in legacy atoms)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       LEGACY STATE LAYER                        │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  studyPlanAtom  │  │ allCourseInfoState│  │currentEnrollments│  │
│  │                 │  │                 │  │     State       │  │
│  │ • currentPlan   │  │ • course details│  │ • enrollments   │  │
│  │ • allPlans      │  │ • ratings       │  │ • semester data │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ (bridged by)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     UNIFIED DATA BRIDGE                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                useUnifiedDataBridge                    │     │
│  │                                                         │     │
│  │  • Reads existing studyPlanAtom (NO duplicate API)     │     │
│  │  • Transforms legacy format → unified format           │     │
│  │  • Enriches courses with details & classifications     │     │
│  │  • Handles live updates from EventListContainer        │     │
│  │  • Provides bidirectional synchronization              │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ (updates)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   UNIFIED STATE LAYER                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              unifiedAcademicDataState                  │     │
│  │    ┌─────────────────────────────────────────────────┐  │     │
│  │    │        programs: {                              │  │     │
│  │    │  "Bachelor in Information Systems": {          │  │     │
│  │    │    transcript: {                                │  │     │
│  │    │      rawScorecard: {...}                       │  │     │
│  │    │      processedTranscript: {...}                │  │     │
│  │    │      mergedTranscript: {...}                   │  │     │
│  │    │    },                                           │  │     │
│  │    │    studyPlan: {                                 │  │     │
│  │    │      semesterMap: {                             │  │     │
│  │    │        "HS24": [enriched courses...]           │  │     │
│  │    │        "FS25": [enriched courses...]           │  │     │
│  │    │      },                                         │  │     │
│  │    │      progress: {completion%, credits...}        │  │     │
│  │    │    },                                           │  │     │
│  │    │    metadata: {programId, isMainStudy...}        │  │     │
│  │    │  }                                              │  │     │
│  │    │}                                                │  │     │
│  │    └─────────────────────────────────────────────────┘  │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ (consumed via selectors)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                        CONSUMING COMPONENTS                      │
│                                                                  │
│  ┌─────────────────┐              ┌─────────────────┐            │
│  │  StudyOverview  │              │   Transcript    │            │
│  │                 │              │                 │            │
│  │ • Uses bridge   │              │ • Uses bridge   │            │
│  │ • Live updates  │              │ • Live updates  │            │
│  │ • No API calls  │              │ • No API calls  │            │
│  └─────────────────┘              └─────────────────┘            │
└──────────────────────────────────────────────────────────────────┘

     DATA FLOW: EventListContainer → Bridge → Unified State → Components
               ◄────────────── Live Updates ──────────────►
```

## Component Architecture

### 1. EventListContainer Component (PRIMARY DATA ORCHESTRATOR)

**Purpose**: Course selection interface AND central data coordinator for the entire application

**Architecture**:
```
EventListContainer
├── useEventListDataManager (master coordinator)
│   ├── useStudyPlanData (fetches study plans)
│   ├── useEnrolledCoursesData (fetches enrollments)
│   ├── useCourseInfoData (fetches course details)
│   ├── useCourseRatingsData (fetches SHSG ratings)
│   └── useUnifiedCourseData (updates unified course data)
└── Manages course selections, filtering, virtualization
```

**Data Flow**:
1. **Coordinates all data fetching** via `useEventListDataManager`
2. **Stores data in legacy atoms** (`studyPlanAtom`, `allCourseInfoState`, etc.)
3. **Updates unified course data** for semester filtering and course browsing
4. **Provides data foundation** for StudyOverview/Transcript via `useUnifiedDataBridge`
5. **Handles bidirectional updates** with other components

**Key Responsibilities**:
- ✅ **Master Data Coordinator**: Orchestrates ALL API calls for the application
- ✅ **Study Plan Authority**: Fetches and manages study plans from backend
- ✅ **Course Information Hub**: Manages course details, enrollments, and ratings
- ✅ **Unified Data Initializer**: Updates `unifiedCourseDataState` with available/filtered courses
- ✅ **Legacy System Maintainer**: Updates both index-based and semester-key-based selections
- ✅ **Live Update Source**: Provides real-time data for StudyOverview/Transcript

### 2. StudyOverview Component (DATA CONSUMER)

**Purpose**: Displays academic progress with semester-organized courses

**Data Flow**:
1. **Uses `useUnifiedDataBridge('StudyOverview', handleError)`**
2. **Bridge reads from existing `studyPlanAtom`** (populated by EventListContainer)
3. **Transforms and enriches data** into unified format with full course details
4. **Consumes enriched data** via `mainProgramStudyPlanSelector`
5. **Receives live updates** via `localSelectedCoursesSemKeyState` dependency



### 3. Transcript Component (DATA CONSUMER)

**Purpose**: Displays official transcript with merged wishlist courses

**Data Flow**:
1. **Uses `useUnifiedDataBridge('Transcript', handleError)`**
2. **Bridge reads from existing `studyPlanAtom`** and enriches with course details
3. **Gets transcript data** via `currentProgramDataSelector`
4. **Gets enriched wishlist courses** via `mainProgramStudyPlanSelector`
5. **Merges wishlist into transcript** categories using `course.classification`
6. **Receives live updates** via `localSelectedCoursesSemKeyState` dependency

**Key Features**:
- ✅ **Shared Data Store**: Uses same study plan data as EventListContainer
- ✅ **Live Course Addition**: Shows newly selected courses immediately
- ✅ **Bidirectional Removal**: Course removal updates EventListContainer
- ✅ **Category Matching**: Uses `course.classification` for intelligent placement
- ✅ **Zero Re-fetching**: Builds entirely on EventListContainer's existing data

### 4. Unified Data Bridge (CRITICAL ARCHITECTURAL COMPONENT)

**File**: `useUnifiedDataBridge.js`

**Purpose**: Central hub that eliminates duplicate API calls by bridging EventListContainer's data to unified academic system

**Architecture**:
```
EventListContainer Data Sources → useUnifiedDataBridge → Unified Academic Data
├── studyPlanAtom (study plans)     ├── Data transformation    ├── StudyOverview
├── scorecardDataState (transcripts)├── Course enrichment      └── Transcript
├── currentEnrollmentsState         ├── Format conversion
└── allCourseInfoState              └── Live updates
```


**Data Processing Pipeline**:
1. **Monitors EventListContainer State**: Watches `studyPlanAtom`, `scorecardDataState`
2. **Transforms Study Plan Data**: Converts to unified `semesterMap` format
3. **Enriches Course Details**: Calls `getLightCourseDetails` API for names/classifications
4. **Handles Future Semesters**: Uses reference semester logic for course projections
5. **Updates Unified State**: Populates `unifiedAcademicDataState` with enriched data
6. **Propagates Live Changes**: Updates unified data when `localSelectedCoursesSemKeyState` changes

## Data Structure

### Unified Academic Data State

```javascript
{
  programs: {
    "Bachelor in Information Systems": {
      transcript: {
        rawScorecard: {}, // Raw data from university API
        processedTranscript: {}, // Organized by semesters/categories
        mergedTranscript: {}, // Includes wishlist courses
        lastFetched: "2025-01-17T..."
      },
      studyPlan: {
        semesterMap: {
          "HS24": [
            {
              id: "11,902,1.00",
              name: "Introduction to Programming",
              credits: 6,
              type: "core-wishlist",
              big_type: "core",
              grade: null
            }
          ]
        },
        progress: {
          totalCreditsRequired: 180,
          totalCreditsCompleted: 120,
          totalCreditsPlanned: 30,
          completionPercentage: 66.7
        },
        lastUpdated: "2025-01-17T..."
      },
      metadata: {
        programId: "BIS2021",
        programDescription: "Bachelor in Information Systems",
        isMainStudy: true,
        studyRegulationId: "12345",
        attempt: 1
      }
    }
  },
  currentProgram: "Bachelor in Information Systems",
  initialization: {
    isLoading: false,
    isInitialized: true,
    error: null,
    lastInitialized: "2025-01-17T..."
  }
}
```

## Key Selectors

### 1. `currentProgramDataSelector`
- Returns the currently selected program's complete data
- Used by Transcript for accessing raw scorecard

### 2. `mainProgramStudyPlanSelector`
- Returns study plan data for the main program (isMainStudy: true)
- Includes both study-plans API data AND local selections
- Used by both StudyOverview and Transcript

### 3. `unifiedStudyPlanSelector`
- Processes all programs and merges local selections
- Handles course filtering, sorting, and type management
- Primary data source for StudyOverview

### 4. `academicDataInitializationSelector`
- Provides initialization status for loading states
- Used by components to determine when data is ready

## Data Processing Pipeline

### 1. Primary Data Orchestration (EventListContainer)
```
User Opens Application
       ↓
EventListContainer Loads
       ↓
useEventListDataManager Coordinates:
├── useStudyPlanData (fetches study plans)
├── useEnrolledCoursesData (fetches enrollments) 
├── useCourseInfoData (fetches course details)
├── useCourseRatingsData (fetches SHSG ratings)
└── useUnifiedCourseData (updates unified course data)
       ↓
Data Stored in Legacy Atoms:
├── studyPlanAtom
├── currentEnrollmentsState
├── allCourseInfoState
└── localSelectedCoursesSemKeyState
       ↓
EventListContainer Ready (course browsing functional)
```

### 2. Unified Data Bridge Activation
```
User Opens StudyOverview/Transcript
       ↓
useUnifiedDataBridge Initializes
       ↓
Check Prerequisites (auth, scorecard loaded, EventListContainer data ready)
       ↓
Read Existing Study Plan Data (NO duplicate API calls)
       ↓
Process Scorecard Data (transcript content)
       ↓
Transform Study Plans to Unified Format
       ↓
Enrich Courses with Details (progressive loading)
       ↓
Update unifiedAcademicDataState
       ↓
Components Render with Enriched Data
```

### 3. Live Update Synchronization
```
User Selects/Deselects Course in EventListContainer
       ↓
localSelectedCoursesSemKeyState Updates
       ↓
useUnifiedDataBridge Detects Change
       ↓
Updates unifiedAcademicDataState.studyPlan.semesterMap
       ↓
StudyOverview/Transcript Re-render with New Data
       ↓
Bidirectional Sync: Course removal in Transcript updates EventListContainer
```

### 2. Course Processing
```
Raw Course ID: "11,902,1.00"
       ↓
Legacy Filter: ✅ Pass (has comma format)
       ↓
Enrich with Course Details API
       ↓
Enhanced Course Object:
{
  id: "11,902,1.00",
  name: "Introduction to Programming",
  credits: 6,
  type: "core-wishlist",
  big_type: "core"
}
```

### 3. Transcript Merging
```
Raw Transcript Structure
       ↓
Extract Wishlist Courses
       ↓
Build Category Mapping (remove -wishlist suffix)
       ↓
Traverse Transcript Tree
       ↓
Match Categories (case-insensitive, with plurals)
       ↓
Insert Wishlist Courses with isWishlist: true
       ↓
Merged Transcript for Display
```