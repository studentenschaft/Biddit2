import { describe, it, expect } from 'vitest'
import { calculateCreditsAndGrades, calculateSemesterCredits } from '../calculateGrades'

describe('calculateCreditsAndGrades', () => {
  it('computes weighted sums for basic items', () => {
    // Arrange
    const items = [
      { isTitle: false, sumOfCredits: '3.0', mark: '5.0', description: 'Regular Course', shortName: 'C1' },
      { isTitle: false, sumOfCredits: '2', mark: 4, description: 'Regular Course 2', shortName: 'C2' },
    ]

    // Act
    const result = calculateCreditsAndGrades(items)

    // Assert
    expect(result).toEqual({
      totalCredits: 5,
      gradeSum: 5 * 3 + 4 * 2, // 23
      filteredCredits: 5,
      customGradeSum: 5 * 3 + 4 * 2, // default custom uses real mark
      customEctsSum: 5,
    })
  })

  it('excludes Campus and Practice Credits from grade and filteredCredits but counts totalCredits', () => {
    // Arrange
    const items = [
      { isTitle: false, sumOfCredits: '1.5', mark: '6.0', description: 'Campus Credits', shortName: 'CC' },
      { isTitle: false, sumOfCredits: '2.5', mark: '5.0', description: 'Practice Credits', shortName: 'PC' },
      { isTitle: false, sumOfCredits: '3', mark: '4.0', description: 'Regular', shortName: 'R' },
    ]

    // Act
    const result = calculateCreditsAndGrades(items)

    // Assert
    expect(result.totalCredits).toBeCloseTo(1.5 + 2.5 + 3)
    expect(result.filteredCredits).toBeCloseTo(3) // only the regular course counts
    expect(result.gradeSum).toBeCloseTo(4 * 3)
    expect(result.customGradeSum).toBeCloseTo(4 * 3)
    expect(result.customEctsSum).toBeCloseTo(3)
  })

  it('excludes passed courses (gradeText includes "p") from grade calculations', () => {
    // Arrange
    const items = [
      { isTitle: false, sumOfCredits: '2', mark: '3.5', description: 'Regular', gradeText: 'P', shortName: 'P1' },
      { isTitle: false, sumOfCredits: '2', mark: '5.5', description: 'Regular', shortName: 'R1' },
    ]

    // Act
    const result = calculateCreditsAndGrades(items)

    // Assert
    expect(result.totalCredits).toBeCloseTo(4)
    expect(result.filteredCredits).toBeCloseTo(2)
    expect(result.gradeSum).toBeCloseTo(5.5 * 2)
    expect(result.customGradeSum).toBeCloseTo(5.5 * 2)
    expect(result.customEctsSum).toBeCloseTo(2)
  })

  it('uses custom grades when provided via getCustomGrade', () => {
    // Arrange
    const items = [
      { isTitle: false, sumOfCredits: '3', mark: '4.0', description: 'Regular', shortName: 'A' },
      { isTitle: false, sumOfCredits: '2', mark: '5.0', description: 'Regular', shortName: 'B' },
    ]
    const custom = (shortName) => (shortName === 'A' ? 5.5 : null)

    // Act
    const result = calculateCreditsAndGrades(items, custom)

    // Assert
    // gradeSum still uses original marks; customGradeSum uses overrides where present
    expect(result.gradeSum).toBeCloseTo(4 * 3 + 5 * 2)
    expect(result.customGradeSum).toBeCloseTo(5.5 * 3 + 5 * 2)
    expect(result.customEctsSum).toBeCloseTo(5) // both counted since custom-defined or original mark present
  })

  it('handles nested title items and thesis placeholder with maxCredits', () => {
    // Arrange
    const thesisCategory = {
      isTitle: true,
      description: 'Master Thesis (Title in original language)',
      maxCredits: '30.00',
      items: [], // triggers placeholder
    }
    const categoryWithChildren = {
      isTitle: true,
      description: 'Electives',
      items: [
        { isTitle: false, sumOfCredits: '3', mark: '5', description: 'Regular', shortName: 'E1' },
        { isTitle: false, sumOfCredits: '2', mark: '4', description: 'Regular', shortName: 'E2' },
      ],
    }

    // Act
    const result = calculateCreditsAndGrades([thesisCategory, categoryWithChildren])

    // Assert
    // Thesis placeholder adds 30 credits to total, but no grade contribution
    expect(result.totalCredits).toBeCloseTo(30 + 3 + 2)
    expect(result.filteredCredits).toBeCloseTo(3 + 2)
    expect(result.gradeSum).toBeCloseTo(5 * 3 + 4 * 2)
    expect(result.customGradeSum).toBeCloseTo(5 * 3 + 4 * 2)
    expect(result.customEctsSum).toBeCloseTo(5)
  })
})

describe('calculateSemesterCredits', () => {
  it('sums credits from mixed fields', () => {
    // Arrange
    const courses = [
      { credits: '3' },
      { sumOfCredits: '2.5' },
      { credits: 1 },
      { credits: 'NaN' },
    ]

    // Act
    const total = calculateSemesterCredits(courses)

    // Assert
    expect(total).toBeCloseTo(3 + 2.5 + 1)
  })
})

